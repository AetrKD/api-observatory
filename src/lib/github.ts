import { progressAt, type ProgressReporter } from "./analysis-progress";
import {
  ANALYSIS_LIMITS as limits,
  analysisLimitMessage,
  supportedSource,
} from "./analysis-policy";
import { analyzeSources } from "./analyzer";
import type { Analysis, SourceFile } from "./types";
export class AnalysisError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}
export function repositoryIdentity(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AnalysisError("공개 GitHub 저장소 주소를 입력해 주세요.");
  }
  const parts = url.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    parts.length !== 2 ||
    !parts.every((x) => /^[\w.-]+$/.test(x))
  )
    throw new AnalysisError(
      "https://github.com/소유자/저장소 형식만 지원합니다.",
    );
  const owner = parts[0],
    repo = parts[1].replace(/\.git$/, "");
  if (!repo || [".", ".."].includes(repo) || [".", ".."].includes(owner))
    throw new AnalysisError("올바른 저장소 주소가 아닙니다.");
  return { owner, repo, url: "https://github.com/" + owner + "/" + repo };
}
type Item = { path: string; type: string; sha: string; size?: number };
export async function analyzeRepository(
  input: string,
  fetcher: typeof fetch = fetch,
  access: { token?: string; allowPrivate?: boolean } = {},
  onProgress: ProgressReporter = async () => {},
): Promise<Analysis> {
  const id = repositoryIdentity(input),
    prefix = "/repos/" + id.owner + "/" + id.repo;
  const controller = new AbortController(),
    deadline = Date.now() + limits.timeoutMs,
    timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  async function api<T>(endpoint: string): Promise<T> {
    const token = access.token ?? process.env.GITHUB_SOURCE_TOKEN;
    const response = await fetcher("https://api.github.com" + endpoint, {
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        "User-Agent": "API-Observatory",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
    });
    if (!response.ok)
      throw new AnalysisError(
        response.status === 404
          ? "저장소를 찾을 수 없거나 공개 저장소가 아닙니다."
          : [403, 429].includes(response.status)
            ? "GitHub 요청 한도 또는 접근 제한으로 분석하지 못했습니다."
            : "GitHub 응답 오류: " + response.status,
        response.status === 404 ? 404 : 502,
      );
    return response.json() as Promise<T>;
  }
  try {
    await onProgress(progressAt("access"));
    const repo = await api<{ private: boolean; default_branch: string }>(
      prefix,
    );
    if (repo.private && !access.allowPrivate)
      throw new AnalysisError("공개 저장소만 지원합니다.");
    await onProgress(progressAt("listing"));
    const ref = await api<{ object: { sha: string } }>(
      prefix +
        "/git/ref/heads/" +
        repo.default_branch.split("/").map(encodeURIComponent).join("/"),
    );
    const commit = await api<{ tree: { sha: string } }>(
      prefix + "/git/commits/" + ref.object.sha,
    );
    const tree = await api<{ tree: Item[]; truncated: boolean }>(
      prefix + "/git/trees/" + commit.tree.sha + "?recursive=1",
    );
    if (tree.truncated)
      throw new AnalysisError(
        "저장소 파일 목록이 너무 커서 완전하게 읽을 수 없습니다.",
      );
    const files = tree.tree.filter(
      (x) => x.type === "blob" && supportedSource(x.path),
    );
    if (!files.length)
      throw new AnalysisError(
        "지원하는 JavaScript·TypeScript·Python·Vue·HTML 소스가 없습니다.",
      );
    if (
      files.length > limits.maxFiles ||
      files.some((x) => (x.size ?? 0) > limits.maxFileBytes) ||
      files.reduce((s, x) => s + (x.size ?? 0), 0) > limits.maxTotalBytes
    )
      throw new AnalysisError(analysisLimitMessage);
    const sources: SourceFile[] = [];
    let bytes = 0;
    await onProgress(progressAt("reading", 0, files.length));
    for (let i = 0; i < files.length; i += limits.readConcurrency) {
      await Promise.all(
        files.slice(i, i + limits.readConcurrency).map(async (file) => {
          let content: Buffer;
          if (!repo.private) {
            const response = await fetcher(
              "https://raw.githubusercontent.com/" +
                id.owner +
                "/" +
                id.repo +
                "/" +
                encodeURIComponent(ref.object.sha) +
                "/" +
                file.path.split("/").map(encodeURIComponent).join("/"),
              {
                signal: controller.signal,
                redirect: "error",
                cache: "no-store",
                headers: { "User-Agent": "API-Observatory" },
              },
            );
            if (!response.ok)
              throw new AnalysisError(
                [403, 429].includes(response.status)
                  ? "GitHub 요청 한도 또는 접근 제한으로 분석하지 못했습니다."
                  : "소스 파일을 읽지 못했습니다. HTTP " + response.status,
                502,
              );
            const reader = response.body?.getReader();
            const chunks: Uint8Array[] = [];
            let size = 0;
            if (reader) {
              try {
                while (true) {
                  const part = await reader.read();
                  if (part.done) break;
                  size += part.value.byteLength;
                  bytes += part.value.byteLength;
                  if (
                    size > limits.maxFileBytes ||
                    bytes > limits.maxTotalBytes
                  ) {
                    await reader.cancel();
                    throw new AnalysisError(
                      "읽은 소스 크기가 지원 한도를 초과했습니다.",
                    );
                  }
                  chunks.push(part.value);
                }
              } finally {
                reader.releaseLock();
              }
            }
            content = Buffer.concat(chunks);
          } else {
            const blob = await api<{
              content: string;
              encoding: string;
              size: number;
            }>(prefix + "/git/blobs/" + file.sha);
            if (blob.encoding !== "base64" || blob.size > limits.maxFileBytes)
              throw new AnalysisError(
                "파일 형식 또는 크기가 지원 범위를 벗어났습니다.",
              );
            content = Buffer.from(blob.content, "base64");
            bytes += content.length;
            if (
              content.length > limits.maxFileBytes ||
              bytes > limits.maxTotalBytes
            )
              throw new AnalysisError(
                "읽은 소스 크기가 지원 한도를 초과했습니다.",
              );
          }
          sources.push({ path: file.path, content: content.toString("utf8") });
        }),
      );
      await onProgress(progressAt("reading", sources.length, files.length));
    }
    await onProgress(progressAt("analyzing", sources.length, files.length));
    sources.sort((a, b) => a.path.localeCompare(b.path));
    const result = analyzeSources(sources);
    if (Date.now() >= deadline)
      throw new AnalysisError("분석 제한 시간 120초를 초과했습니다.", 504);
    if (!result.findings.length)
      throw new AnalysisError(
        result.parseErrors.length
          ? "코드 파싱에 실패했거나 지원하는 탐지 방식으로 외부 API를 찾지 못했습니다."
          : "지원하는 탐지 방식으로 외부 API를 찾지 못했습니다. API가 없다는 뜻은 아닙니다.",
      );
    return {
      repository: id.url,
      commit: ref.object.sha,
      analyzedAt: new Date().toISOString(),
      ...result,
      skippedFiles:
        tree.tree.filter((x) => x.type === "blob").length - files.length,
      warnings: [
        ...result.warnings,
        "코드를 실행하지 않는 정적 분석입니다. 실제 응답 상태를 검증하지 않았습니다.",
        ...(result.parseErrors.length
          ? ["일부 파일의 파싱에 실패했습니다. 누락 가능성이 있습니다."]
          : []),
      ],
      findings: result.findings.map((f) => ({
        ...f,
        codeUrl:
          id.url +
          "/blob/" +
          ref.object.sha +
          "/" +
          f.file.split("/").map(encodeURIComponent).join("/") +
          "#L" +
          f.line,
      })),
    };
  } catch (error) {
    if (controller.signal.aborted)
      throw new AnalysisError("분석 제한 시간 120초를 초과했습니다.", 504);
    controller.abort();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
