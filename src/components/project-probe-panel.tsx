"use client";
import { useEffect, useRef, useState } from "react";
import type { Analysis, Finding } from "@/lib/types";
import type {
  ProjectProfile,
  ProjectRun,
  ProjectExecution,
  ProjectTestingState,
  ProjectApiResult,
} from "@/lib/checks/project-types";
import { ResponseFormatSelect } from "./response-format-select";
import { useLanguage } from "./language-provider";
async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "요청 실패");
  return data;
}
const empty = {
  deploymentUrl: "",
  authType: "none",
  responseFormat: "default",
  headerName: "X-API-Key",
  secret: "",
  autoEnabled: true,
};
export function ProjectProbePanel({
  repositoryId,
  analysis,
  onState,
}: {
  repositoryId: string;
  analysis: Analysis | null;
  onState: (state: ProjectTestingState) => void;
}) {
  const { t, locale } = useLanguage();
  const [profile, setProfile] = useState<ProjectProfile | null>(null),
    [form, setForm] = useState(empty),
    [run, setRun] = useState<ProjectRun | null>(null),
    [phase, setPhase] = useState<ProjectTestingState["phase"]>("idle"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const generation = useRef(0),
    hydrated = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const endpoint = "/api/repositories/" + repositoryId + "/project-checks";
  useEffect(() => {
    onState({
      repositoryId,
      configured: Boolean(profile?.deploymentUrl),
      phase,
      run,
    });
  }, [repositoryId, profile?.deploymentUrl, phase, run, onState]);
  async function execute(force: boolean, token = generation.current) {
    clearTimeout(timer.current);
    setPhase("running");
    setError("");
    try {
      const result: ProjectExecution = await api(endpoint, {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      if (token !== generation.current) return;
      if (result.disabled) {
        setPhase("idle");
        return;
      }
      if (result.run) {
        setRun(result.run);
        setPhase("idle");
      } else {
        setPhase(result.running ? "running" : "waiting");
        timer.current = setTimeout(() => {
          if (token === generation.current) {
            if (result.running) void load(token, false);
            else void execute(force, token);
          }
        }, result.retryAfterMs ?? 2000);
      }
    } catch (e) {
      if (token === generation.current) {
        setPhase("idle");
        setError(
          e instanceof Error ? e.message : "응답 조회를 완료하지 못했습니다.",
        );
      }
    }
  }
  async function load(token: number, hydrate: boolean) {
    try {
      if (!hydrate) {
        const status = await api(endpoint + "?progress=1");
        if (token !== generation.current) return;
        if (status?.running) {
          setPhase("running");
          timer.current = setTimeout(() => {
            if (token === generation.current) void load(token, false);
          }, 1500);
          return;
        }
      }
      const data: ProjectProfile | null = await api(endpoint);
      if (token !== generation.current) return;
      setProfile(data);
      setRun((old) =>
        old?.checkedAt === data?.latest?.checkedAt
          ? old
          : (data?.latest ?? null),
      );
      if (hydrate && !hydrated.current) {
        setForm(
          data
            ? {
                deploymentUrl: data.deploymentUrl,
                authType: data.authType,
                responseFormat: data.responseFormat ?? "default",
                headerName: data.headerName,
                secret: "",
                autoEnabled: data.autoEnabled,
              }
            : empty,
        );
        hydrated.current = true;
      }
      setLoading(false);
      if (data?.running) {
        setPhase("running");
        timer.current = setTimeout(() => {
          if (token === generation.current) void load(token, false);
        }, 1500);
        return;
      }
      setPhase("idle");
      const latest = data?.latest;
      const fresh = Boolean(
        latest &&
        latest.commit === analysis?.commit &&
        latest.analysisAt === analysis?.analyzedAt &&
        latest.revision === data?.revision &&
        Date.now() - Date.parse(latest.checkedAt) < 300000,
      );
      if (data?.deploymentUrl && data.autoEnabled && analysis && !fresh)
        await execute(false, token);
      else if (data?.lastError) setError(data.lastError);
    } catch (e) {
      if (token === generation.current) {
        setLoading(false);
        setPhase("idle");
        setError(e instanceof Error ? e.message : "요청 실패");
      }
    }
  }
  useEffect(() => {
    const token = ++generation.current;
    clearTimeout(timer.current);
    void load(token, true);
    return () => {
      generation.current++;
      clearTimeout(timer.current);
    };
  }, [repositoryId, analysis?.commit, analysis?.analyzedAt]);
  async function save() {
    const token = ++generation.current;
    clearTimeout(timer.current);
    setError("");
    setPhase("running");
    try {
      const data: ProjectProfile = await api(endpoint, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      if (token !== generation.current) return;
      setProfile(data);
      setRun(null);
      setForm({
        deploymentUrl: data.deploymentUrl,
        authType: data.authType,
        responseFormat: data.responseFormat ?? "default",
        headerName: data.headerName,
        secret: "",
        autoEnabled: data.autoEnabled,
      });
      if (data.deploymentUrl && analysis) await execute(true, token);
      else setPhase("idle");
    } catch (e) {
      if (token === generation.current) {
        setPhase("idle");
        setError(e instanceof Error ? e.message : "요청 실패");
      }
    }
  }
  const busy = loading || phase === "running";
  return (
    <section
      className="project-probe-panel"
      aria-label={t("프로젝트 응답 자동 조회")}
    >
      <div className="project-probe-heading">
        <div>
          <span className="eyebrow">{t("실시간 API 응답")}</span>
          <h2>{t("배포 주소 한 번으로 응답 확인")}</h2>
        </div>
        <span
          className={"live-badge " + (profile?.deploymentUrl ? "ready" : "")}
        >
          {profile?.deploymentUrl ? t("설정됨") : t("선택 설정")}
        </span>
      </div>
      <p className="muted">
        {t(
          "주소를 입력하면 같은 도메인의 GET API 응답이 목록과 상세에 표시됩니다. 비워두면 코드 분석만 사용합니다.",
        )}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="deployment-label">
          <label htmlFor={"deployment-" + repositoryId}>
            {t("배포 주소 (선택)")}
          </label>
          <div className="deployment-row">
            <input
              id={"deployment-" + repositoryId}
              aria-label={t("배포 주소 (선택)")}
              type="url"
              disabled={busy}
              value={form.deploymentUrl}
              onChange={(e) =>
                setForm({ ...form, deploymentUrl: e.target.value })
              }
              placeholder="https://my-service.example.com"
            />
            <button disabled={busy}>
              {loading
                ? t("설정 불러오는 중")
                : busy
                  ? t("응답 조회 중")
                  : form.deploymentUrl
                    ? t("저장하고 응답 조회")
                    : t("설정 저장")}
            </button>
          </div>
        </div>
        <details className="project-auth-settings">
          <summary>
            {t("인증·자동 조회 설정")}
            {profile?.hasCredential ? " · " + t("인증 정보 등록됨") : ""}
          </summary>
          <div className="project-auth-grid">
            <ResponseFormatSelect
              value={form.responseFormat}
              onChange={(value) => setForm({ ...form, responseFormat: value })}
              disabled={busy}
            />
            <label>
              {t("인증 방식")}
              <select
                disabled={busy}
                value={form.authType}
                onChange={(e) => setForm({ ...form, authType: e.target.value })}
              >
                <option value="none">{t("인증 없음")}</option>
                <option value="bearer">{t("Bearer 토큰")}</option>
                <option value="header">{t("API 키 헤더")}</option>
              </select>
            </label>
            {form.authType === "header" && (
              <label>
                {t("헤더 이름")}
                <input
                  disabled={busy}
                  value={form.headerName}
                  onChange={(e) =>
                    setForm({ ...form, headerName: e.target.value })
                  }
                />
              </label>
            )}
            {form.authType !== "none" && (
              <label>
                {t("읽기 전용 키·토큰")}
                <input
                  type="password"
                  autoComplete="new-password"
                  disabled={busy}
                  required={
                    Boolean(form.deploymentUrl) && !profile?.hasCredential
                  }
                  value={form.secret}
                  placeholder={
                    profile?.hasCredential ? t("(비워두면 기존 값 유지)") : ""
                  }
                  onChange={(e) => setForm({ ...form, secret: e.target.value })}
                />
              </label>
            )}
          </div>
          <label className="project-auto-toggle">
            <input
              type="checkbox"
              disabled={busy}
              checked={form.autoEnabled}
              onChange={(e) =>
                setForm({ ...form, autoEnabled: e.target.checked })
              }
            />
            {t("프로젝트 열기·재분석 후 자동 조회")}
          </label>
          <p className="muted">
            {t(
              "최근 5분 결과는 재사용합니다. 공통 인증은 배포 도메인에만 보내며 한 번에 주소 20개까지 조회합니다.",
            )}
          </p>
          <p className="muted">
            {t("전체 조회는 계정당 30초 간격으로 실행합니다.")}
          </p>
        </details>
      </form>
      <div className="project-probe-footer">
        <span role="status">
          {phase === "running" ? (
            t("GET 응답을 확인하고 있습니다.")
          ) : phase === "waiting" ? (
            t("잠시 후 자동으로 응답을 조회합니다.")
          ) : run &&
            run.commit === analysis?.commit &&
            run.analysisAt === analysis?.analyzedAt ? (
            <>
              {t("응답 확인")} {run.checkedCount}
              {t("개")} · {t("자동 조회 제외")} {run.skippedCount}
              {t("개")} · {new Date(run.checkedAt).toLocaleString(locale)}
            </>
          ) : profile?.deploymentUrl ? (
            t("조회할 분석 결과를 준비하고 있습니다.")
          ) : (
            t("배포 주소 없이도 분석 결과를 볼 수 있습니다.")
          )}
        </span>
        {profile?.deploymentUrl && (
          <button
            type="button"
            className="button-secondary"
            disabled={busy || phase === "waiting" || !analysis}
            onClick={() => void execute(true)}
          >
            {t("전체 응답 새로고침")}
          </button>
        )}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {t(error)}
        </p>
      )}
    </section>
  );
}
export function LiveApiResult({
  result,
  finding,
  configured,
  phase,
}: {
  result?: ProjectApiResult;
  finding: Finding;
  configured: boolean;
  phase: ProjectTestingState["phase"];
}) {
  const { t, locale } = useLanguage();
  const canCheck = finding.method === "GET" && finding.service === "HTTP";
  return (
    <section className="inline-api-response" aria-label={t("API 실제 응답")}>
      <div className="account-heading">
        <strong>{t("API 실제 응답")}</strong>
        <span className={"live-badge " + (result?.status ?? "")}>
          {phase === "running" && canCheck
            ? t("조회 중")
            : result?.httpCode
              ? "HTTP " + result.httpCode
              : result?.status === "error"
                ? t("연결 실패")
                : result?.status === "skipped" || !canCheck
                  ? t("자동 조회 제외")
                  : configured
                    ? t("조회 대기")
                    : t("설정 필요")}
        </span>
      </div>
      {!canCheck ? (
        <p>{t("조회용 GET 호출만 자동으로 확인합니다.")}</p>
      ) : result ? (
        <>
          <p>{t(result.reason)}</p>
          {result.url && <p className="code">{result.url}</p>}
          {result.checkedAt && (
            <small>
              {new Date(result.checkedAt).toLocaleString(locale)} ·{" "}
              {result.durationMs ?? "—"} ms
            </small>
          )}
          {result.preview ? (
            <details className="response-preview" open>
              <summary>{t("응답 본문 미리보기")}</summary>
              {result.preview.format === "binary" ? (
                <p>{t("바이너리 응답은 본문 미리보기를 지원하지 않습니다.")}</p>
              ) : (
                <pre tabIndex={0}>
                  {result.preview.body || t("응답 본문이 비어 있습니다.")}
                </pre>
              )}
              {result.preview.truncated && (
                <small>{t("미리보기는 앞부분 16 KiB까지만 표시합니다.")}</small>
              )}
            </details>
          ) : (
            result.checkedAt && (
              <p className="muted">
                {t("본문 미리보기는 새로 조회한 직후에 볼 수 있습니다.")}
              </p>
            )
          )}
        </>
      ) : (
        <p>
          {t(
            configured
              ? "응답을 조회하면 코드·시간·본문이 여기에 표시됩니다."
              : "상단에 배포 주소를 입력하면 실제 응답이 자동으로 표시됩니다.",
          )}
        </p>
      )}
    </section>
  );
}
