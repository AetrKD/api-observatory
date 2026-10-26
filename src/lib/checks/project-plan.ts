import type { Finding } from "../types";
import type { ProjectApiResult } from "./project-types";
import { checkUrl } from "./policy";
export const projectProbeLimit = 20;
export function planProjectRequests(findings: Finding[], deployment: string) {
  const base = checkUrl(deployment),
    targets = new Map<string, string[]>(),
    results: ProjectApiResult[] = [];
  for (const f of findings) {
    let url: string | null = null,
      reason = "";
    if (f.service !== "HTTP" || f.method !== "GET")
      reason = "조회용 GET 호출만 자동으로 확인합니다.";
    else if (!f.address || f.resolution === "unresolved")
      reason = "주소를 확정할 수 없어 개별 설정이 필요합니다.";
    else {
      try {
        if (f.address.startsWith("/") && !f.address.startsWith("//"))
          url = new URL(f.address, base.origin).href;
        else if (f.address.startsWith("https://")) url = f.address;
        else throw new Error("Unresolved path");
        url = checkUrl(url).href;
        if (url.length > 2048) {
          reason = "자동 조회 주소는 2048자 이하로 입력해 주세요.";
          url = null;
        } else if (new URL(url).origin !== base.origin) {
          reason = "다른 도메인의 API는 개별 점검을 사용하세요.";
          url = null;
        } else if (!targets.has(url) && targets.size >= projectProbeLimit)
          reason = "한 번에 조회할 수 있는 주소 20개를 초과했습니다.";
        else targets.set(url, [...(targets.get(url) ?? []), f.id]);
      } catch {
        reason = "자동 조회에는 유효한 공개 HTTPS 주소가 필요합니다.";
        url = null;
      }
    }
    results.push({
      findingId: f.id,
      url,
      status: "skipped",
      reason: reason || "응답 조회 대기 중",
      httpCode: null,
      durationMs: null,
      checkedAt: null,
    });
  }
  return { targets, results };
}
