import { responseFormat, acceptHeader, type ResponseFormat } from "./accept";
import { randomUUID } from "node:crypto";
import { db, one, ownedRepo, snapshot } from "../server/store";
import { repositoryAccess } from "../github/access";
import { AppError } from "../server/http";
import { seal, unseal, type Sealed } from "./crypto";
import { checkUrl, headerName, evaluate } from "./policy";
import { protectedRequest } from "./request";
import { responsePreview } from "./preview";
import { planProjectRequests } from "./project-plan";
import type {
  ProjectProfile,
  ProjectRun,
  ProjectExecution,
} from "./project-types";
type Row = {
  repository_id: string;
  owner_id: string;
  deployment_url: string | null;
  response_format: ResponseFormat;
  auth_type: "none" | "bearer" | "header";
  header_name: string | null;
  credential: string | null;
  auto_enabled: number;
  revision: string;
  latest_result: string | null;
  lease_id: string | null;
  lease_until: number | null;
  last_run_at: number | null;
  last_error: string | null;
};
const aad = (owner: string, id: string) => owner + ":" + id + ":project-probe";
async function access(owner: string, id: string, progressOnly = false) {
  const repo = await ownedRepo(owner, id);
  if (repo.private && !progressOnly) await repositoryAccess(owner, repo);
}
async function row(owner: string, id: string) {
  return one<Row>(
    "select * from project_probes where owner_id=? and repository_id=?",
    [owner, id],
  );
}
function view(data: Row): ProjectProfile {
  return {
    deploymentUrl: data.deployment_url ?? "",
    authType: data.auth_type,
    responseFormat: data.response_format ?? "default",
    headerName: data.header_name ?? "X-API-Key",
    hasCredential: Boolean(data.credential),
    autoEnabled: Boolean(data.auto_enabled),
    revision: data.revision,
    running: Boolean(
      data.lease_id && data.lease_until && data.lease_until > Date.now(),
    ),
    lastError: data.last_error,
    latest: data.latest_result ? JSON.parse(data.latest_result) : null,
  };
}
export async function getProjectProfile(
  owner: string,
  id: string,
  progressOnly = false,
) {
  await access(owner, id, progressOnly);
  await db().execute({
    sql: "update project_probes set lease_id=null,lease_until=null,last_error=? where owner_id=? and repository_id=? and lease_id is not null and lease_until<=?",
    args: [
      "응답 조회 시간이 초과됐습니다. 다시 조회해 주세요.",
      owner,
      id,
      Date.now(),
    ],
  });
  const data = await row(owner, id);
  return data ? view(data) : null;
}
export async function saveProjectProfile(
  owner: string,
  id: string,
  input: Record<string, unknown>,
) {
  await access(owner, id);
  const existing = await row(owner, id);
  if (existing?.lease_until && existing.lease_until > Date.now())
    throw new AppError("응답 조회 중에는 설정을 변경할 수 없습니다.", 409);
  const raw = String(input.deploymentUrl ?? "").trim();
  let deployment: string | null = null;
  if (raw) {
    const url = checkUrl(raw);
    if (url.search || url.hash || url.pathname !== "/")
      throw new AppError(
        "배포 주소는 경로·쿼리 없이 도메인까지 입력해 주세요.",
      );
    deployment = url.origin;
  }
  const authType = deployment ? String(input.authType ?? "none") : "none";
  if (!["none", "bearer", "header"].includes(authType))
    throw new AppError("인증 방식을 확인해 주세요.");
  const header =
    authType === "header" ? headerName(String(input.headerName ?? "")) : null;
  const secret = typeof input.secret === "string" ? input.secret : "";
  let credential: Sealed | null = existing?.credential
    ? JSON.parse(existing.credential)
    : null;
  if (authType === "none") credential = null;
  else if (secret) {
    if (secret.length > 4000 || /[\r\n]/.test(secret))
      throw new AppError("인증 정보 형식이 올바르지 않습니다.");
    credential = seal(secret, aad(owner, id));
  } else {
    if (existing?.deployment_url !== deployment)
      throw new AppError("전송 대상이 바뀌면 인증 정보를 새로 입력해 주세요.");
    if (!credential)
      throw new AppError("읽기 전용 키 또는 토큰을 입력해 주세요.");
  }
  const format = responseFormat(
    input.responseFormat ?? existing?.response_format,
  );
  const revision = randomUUID();
  const saved = await db().execute({
    sql: `insert into project_probes(repository_id,owner_id,deployment_url,auth_type,header_name,credential,auto_enabled,revision,response_format) values(?,?,?,?,?,?,?,?,?) on conflict(repository_id) do update set deployment_url=excluded.deployment_url,auth_type=excluded.auth_type,header_name=excluded.header_name,credential=excluded.credential,auto_enabled=excluded.auto_enabled,revision=excluded.revision,response_format=excluded.response_format,latest_result=null,last_error=null where project_probes.owner_id=excluded.owner_id and (project_probes.lease_until is null or project_probes.lease_until<=?) returning *`,
    args: [
      id,
      owner,
      deployment,
      authType,
      header,
      credential ? JSON.stringify(credential) : null,
      input.autoEnabled === false ? 0 : 1,
      revision,
      format,
      Date.now(),
    ],
  });
  if (!saved.rows.length)
    throw new AppError("응답 조회 중에는 설정을 변경할 수 없습니다.", 409);
  return view(saved.rows[0] as unknown as Row);
}
export async function runProjectProbe(
  owner: string,
  id: string,
  force = false,
  transport: typeof protectedRequest = protectedRequest,
): Promise<ProjectExecution> {
  await access(owner, id);
  const profile = await row(owner, id);
  if (!profile?.deployment_url)
    throw new AppError("먼저 프로젝트의 배포 주소를 입력해 주세요.");
  const saved = await snapshot(owner, id),
    analysis = saved?.snapshot;
  if (!analysis) throw new AppError("먼저 저장소를 분석해 주세요.");
  if (analysis.findings.length > 1000)
    throw new AppError(
      "자동 응답 조회는 호출 1000개 이하의 분석 결과에서 지원합니다.",
    );
  if (!force && !profile.auto_enabled) return { disabled: true };
  const previous: ProjectRun | null = profile.latest_result
    ? JSON.parse(profile.latest_result)
    : null;
  const now = Date.now();
  if (
    !force &&
    previous?.commit === analysis.commit &&
    previous.revision === profile.revision &&
    previous.analysisAt === analysis.analyzedAt &&
    now - Date.parse(previous.checkedAt) < 300000
  )
    return { run: previous };
  const lease = randomUUID();
  const claim = await db().execute({
    sql: "update project_probes set lease_id=?,lease_until=?,last_run_at=?,last_error=null where repository_id=? and owner_id=? and revision=? and (lease_until is null or lease_until<=?) and (last_run_at is null or last_run_at<=?) and not exists(select 1 from project_probes p where p.owner_id=? and (p.lease_until>? or p.last_run_at>?)) and (select count(*) from project_probes p where p.lease_until>?)<2 returning *",
    args: [
      lease,
      now + 210000,
      now,
      id,
      owner,
      profile.revision,
      now,
      now - 30000,
      owner,
      now,
      now - 30000,
      now,
    ],
  });
  if (!claim.rows.length) {
    const current = await row(owner, id);
    if (!force && !current?.auto_enabled) return { disabled: true };
    if (current?.revision !== profile.revision) return { retryAfterMs: 1000 };
    const budget = await one<{ last: number | null; active: number }>(
      "select max(last_run_at) as last,sum(case when lease_until>? then 1 else 0 end) as active from project_probes where owner_id=?",
      [now, owner],
    );
    return {
      running: Boolean(current?.lease_until && current.lease_until > now),
      retryAfterMs:
        current?.lease_until && current.lease_until > now
          ? 1500
          : Math.max(2000, (budget?.last ?? now - 30000) + 30100 - now),
    };
  }
  try {
    const headers: Record<string, string> = {
        "User-Agent": "API-Observatory-Check",
        Accept: acceptHeader(profile.response_format),
      },
      secrets: string[] = [];
    if (profile.auth_type !== "none") {
      if (!profile.credential) throw new AppError("점검 인증 정보가 없습니다.");
      const secret = unseal(JSON.parse(profile.credential), aad(owner, id));
      if (/[\r\n]/.test(secret))
        throw new AppError("인증 정보 형식이 올바르지 않습니다.");
      secrets.push(secret);
      headers[
        profile.auth_type === "bearer" ? "Authorization" : profile.header_name!
      ] = profile.auth_type === "bearer" ? "Bearer " + secret : secret;
    }
    const plan = planProjectRequests(analysis.findings, profile.deployment_url),
      targets = [...plan.targets.keys()],
      deadline = Date.now() + 145000;
    const byFinding = new Map(plan.results.map((r) => [r.findingId, r]));
    for (let i = 0; i < targets.length; i += 2) {
      if (Date.now() > deadline) {
        for (const url of targets.slice(i))
          for (const finding of plan.targets.get(url)!)
            byFinding.get(finding)!.reason =
              "조회 시간 한도로 이번 요청을 실행하지 못했습니다.";
        break;
      }
      await Promise.all(
        targets.slice(i, i + 2).map(async (url) => {
          const started = Date.now();
          let result;
          try {
            const response = await transport(url, headers);
            result = {
              ...evaluate(response.code, response.text, null, null, null),
              reason:
                response.code >= 200 && response.code < 300
                  ? "HTTP 2xx 응답을 받았습니다."
                  : "HTTP 2xx 이외의 응답입니다.",
              httpCode: response.code,
              durationMs: response.duration,
              checkedAt: new Date().toISOString(),
              preview: responsePreview(
                response.text,
                response.contentType ?? null,
                secrets,
              ),
            };
          } catch (error) {
            result = {
              status: "error" as const,
              reason:
                error instanceof AppError
                  ? error.message
                  : "연결 오류 또는 제한 시간 내 응답 없음",
              httpCode: null,
              durationMs: Date.now() - started,
              checkedAt: new Date().toISOString(),
            };
          }
          const { preview, ...metadata } = result;
          void preview;
          for (const [index, findingId] of plan.targets.get(url)!.entries())
            Object.assign(
              byFinding.get(findingId)!,
              index === 0 ? result : metadata,
            );
        }),
      );
    }
    const results = plan.results,
      run: ProjectRun = {
        repositoryId: id,
        commit: analysis.commit,
        analysisAt: analysis.analyzedAt,
        revision: profile.revision,
        checkedAt: new Date().toISOString(),
        checkedCount: results.filter((r) => r.status !== "skipped").length,
        skippedCount: results.filter((r) => r.status === "skipped").length,
        results,
      };
    const persisted = {
      ...run,
      results: results.map(({ preview, ...result }) => {
        void preview;
        return result;
      }),
    };
    const finish = await db().execute({
      sql: "update project_probes set latest_result=?,lease_id=null,lease_until=null where repository_id=? and owner_id=? and revision=? and lease_id=? and lease_until>?",
      args: [
        JSON.stringify(persisted),
        id,
        owner,
        profile.revision,
        lease,
        Date.now(),
      ],
    });
    if (!finish.rowsAffected)
      throw new AppError("점검 결과를 저장하지 못했습니다.", 503);
    return { run };
  } catch (error) {
    await db().execute({
      sql: "update project_probes set lease_id=null,lease_until=null,last_error=? where repository_id=? and owner_id=? and lease_id=?",
      args: [
        error instanceof AppError
          ? error.message
          : "응답 조회를 완료하지 못했습니다.",
        id,
        owner,
        lease,
      ],
    });
    throw error;
  }
}
