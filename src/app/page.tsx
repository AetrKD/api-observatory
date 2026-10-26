"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Analysis, Finding } from "@/lib/types";
import {
  AccountWorkspace,
  type AccountControls,
  type Repository,
} from "@/components/account-workspace";
import {
  AnalysisProgressCard,
  type AnalysisState,
} from "@/components/analysis-progress";
import { ANALYSIS_LIMITS as limits } from "@/lib/analysis-policy";
import { progressAt } from "@/lib/analysis-progress";
import {
  ProjectProbePanel,
  LiveApiResult,
} from "@/components/project-probe-panel";
import type { ProjectTestingState } from "@/lib/checks/project-types";
import { CheckPanel, type CheckControls } from "@/components/check-panel";
import { LanguageProvider, useLanguage } from "@/components/language-provider";
export default function Home() {
  return (
    <LanguageProvider>
      <WorkspacePage />
    </LanguageProvider>
  );
}
function WorkspacePage() {
  const { language, setLanguage, t, locale } = useLanguage();
  const [view, setView] = useState("analysis"),
    [repos, setRepos] = useState<Repository[]>([]),
    [historyQuery, setHistoryQuery] = useState(""),
    [account, setAccount] = useState({
      email: "",
      ready: false,
      busy: false,
      error: "",
    }),
    [authNotice, setAuthNotice] = useState("");
  const controls = useRef<AccountControls>(null);
  const checkControls = useRef<CheckControls>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [testing, setTesting] = useState<ProjectTestingState>({
    repositoryId: "",
    configured: false,
    phase: "idle",
    run: null,
  });
  const openAnalysis = useCallback(() => setView("analysis"), []);
  const openRepo = (id: string) => {
    controls.current?.open(id);
    setView("analysis");
  };
  const titles: Record<string, string> = {
    analysis: "분석",
    history: "분석 기록",
    repositories: "등록된 저장소",
    about: "서비스 정보",
    help: "사용법",
  };
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.has("error") || query.has("auth_error"))
      setAuthNotice(
        "GitHub 로그인에 실패했거나 승인이 취소되었습니다. 다시 시도해 주세요.",
      );
    else if (query.has("github_error"))
      setAuthNotice(
        "GitHub App 연결에 실패했습니다. 계정 설정에서 다시 연결해 주세요.",
      );
    else if (query.has("github_connected"))
      setAuthNotice(
        "GitHub App 계정이 연결되었습니다. 등록된 저장소에서 프로젝트를 추가하세요.",
      );
    else if (query.has("signed_out")) setAuthNotice("로그아웃되었습니다.");
    if (
      query.has("error") ||
      query.has("auth_error") ||
      query.has("signed_out") ||
      query.has("github_error") ||
      query.has("github_connected")
    )
      history.replaceState(null, "", location.pathname);
  }, []);

  const [signedIn, setSignedIn] = useState(false),
    [repositoryId, setRepositoryId] = useState<string | null>(null);
  const [url, setUrl] = useState(""),
    [result, setResult] = useState<Analysis | null>(null),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [localProgress, setLocalProgress] = useState<AnalysisState | null>(
    null,
  );
  const groups = useMemo(() => {
    const grouped = new Map<string, Finding[]>();
    for (const f of result?.findings ?? []) {
      const key =
        f.service === "HTTP"
          ? f.address && f.resolution === "resolved"
            ? new URL(f.address).origin
            : f.resolution === "internal"
              ? "내부 경로 후보"
              : "주소 미해결"
          : f.service;
      grouped.set(key, [...(grouped.get(key) ?? []), f]);
    }
    return [...grouped.entries()];
  }, [result]);
  useEffect(() => {
    setSelected(
      result?.findings.find((f) => f.method === "GET" && f.service === "HTTP")
        ?.id ??
        result?.findings[0]?.id ??
        "",
    );
  }, [result]);
  const currentTesting = testing.repositoryId === repositoryId ? testing : null;
  const liveResults = useMemo(() => {
    const rows =
      currentTesting?.run?.commit === result?.commit &&
      currentTesting?.run?.analysisAt === result?.analyzedAt
        ? (currentTesting?.run?.results ?? [])
        : [];
    const bodies = new Map(
      rows.filter((r) => r.url && r.preview).map((r) => [r.url!, r.preview!]),
    );
    return new Map(
      rows.map((r) => [
        r.findingId,
        r.preview || !r.url ? r : { ...r, preview: bodies.get(r.url) },
      ]),
    );
  }, [currentTesting?.run, result?.commit, result?.analyzedAt]);
  const active =
    result?.findings.find((f) => f.id === selected) ?? result?.findings[0];
  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setLocalProgress({
      latest_status: "running",
      progress: progressAt("access"),
    });
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      if (!response.body) throw new Error("분석하지 못했습니다.");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "",
        finished = false;
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.error) throw new Error(event.error);
          if (event.progress)
            setLocalProgress({
              latest_status: "running",
              progress: event.progress,
            });
          if (event.result) {
            setResult(event.result);
            setSelected(event.result.findings[0]?.id ?? "");
            finished = true;
            setLocalProgress(null);
          }
        }
        if (done) break;
      }
      if (!finished) throw new Error("분석하지 못했습니다.");
    } catch (e) {
      const reason = e instanceof Error ? e.message : "분석하지 못했습니다.";
      setError(reason);
      setLocalProgress((old) => ({ ...old, latest_status: "failed", reason }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="shell">
      <title>
        {language === "ko"
          ? "API Observatory · 외부 API 분석"
          : "API Observatory · External API analysis"}
      </title>
      <a className="skip-link" href="#main-content">
        {t("본문으로 건너뛰기")}
      </a>
      <aside className="rail">
        <div className="brand">
          <span className="mark">◈</span>
          <div>
            API Observatory<small>{t("외부 API를 한눈에")}</small>
          </div>
        </div>
        <div className="nav-title">{t("워크스페이스")}</div>
        <nav aria-label={t("주 메뉴")}>
          {[
            "analysis",
            "history",
            ...(signedIn ? ["repositories"] : []),
            "about",
            "help",
          ].map((key, index) => (
            <button
              key={key}
              className={"nav " + (view === key ? "active" : "")}
              aria-current={view === key ? "page" : undefined}
              onClick={() => setView(key)}
            >
              <span aria-hidden="true">
                {
                  {
                    analysis: "◈",
                    history: "◷",
                    repositories: "▤",
                    about: "ⓘ",
                    help: "?",
                  }[key]
                }
              </span>
              {t(titles[key])}
            </button>
          ))}
        </nav>
        <div className="rail-foot">
          <p>{t("코드 분석 · API 상태 점검")}</p>
          <span className="pill">
            JavaScript · TypeScript · Python · Vue · HTML
          </span>
        </div>
      </aside>
      <main id="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">API OBSERVATORY</span>
            <h1>{t(titles[view])}</h1>
          </div>
          <div className="topbar-tools">
            <div
              className="language-switch"
              role="group"
              aria-label={t("언어 선택")}
            >
              <button
                onClick={() => setLanguage("ko")}
                aria-pressed={language === "ko"}
                lang="ko"
              >
                한국어
              </button>
              <button
                onClick={() => setLanguage("en")}
                aria-pressed={language === "en"}
                lang="en"
              >
                English
              </button>
            </div>
            {signedIn && (
              <span className="account-email" title={account.email}>
                {account.email}
              </span>
            )}
            <button
              disabled={account.busy || (!signedIn && !account.ready)}
              onClick={() =>
                signedIn
                  ? controls.current?.logout()
                  : controls.current?.login()
              }
            >
              {t(
                account.busy
                  ? "처리 중"
                  : signedIn
                    ? "로그아웃"
                    : "GitHub 로그인",
              )}
            </button>
          </div>
        </header>
        {authNotice && (
          <div className="notice" role="status">
            {t(authNotice)}
            <button
              className="notice-dismiss"
              onClick={() => setAuthNotice("")}
              aria-label={t("알림 닫기")}
            >
              ×
            </button>
          </div>
        )}
        {account.error && (
          <div className="notice error" role="alert">
            {t(account.error)}
          </div>
        )}
        {localProgress && !signedIn && (
          <AnalysisProgressCard state={localProgress} name={url} />
        )}
        <AccountWorkspace
          onAnalysis={setResult}
          onRepository={setRepositoryId}
          onSignedIn={setSignedIn}
          onRepositories={setRepos}
          onAccount={setAccount}
          controlRef={controls}
          view={view}
          onOpenAnalysis={openAnalysis}
        />
        {view === "analysis" && (
          <>
            {signedIn && repositoryId && (
              <ProjectProbePanel
                key={repositoryId}
                repositoryId={repositoryId}
                analysis={result}
                onState={setTesting}
              />
            )}
            {!result && !repositoryId && (
              <section className="intro">
                <h2>{t("코드 속 외부 연결을 살펴보세요.")}</h2>
                <p>
                  {t(
                    "API 호출과 관련 함수를 찾아, 프로젝트의 외부 연동을 한곳에 모읍니다.",
                  )}
                </p>
                {!signedIn && (
                  <form onSubmit={analyze}>
                    <label htmlFor="repository">
                      {t("공개 GitHub 저장소 주소")}
                    </label>
                    <div className="input-row">
                      <span aria-hidden="true">⌘</span>
                      <input
                        id="repository"
                        type="url"
                        required
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://github.com/owner/repository"
                        disabled={busy}
                      />
                      <button disabled={busy}>
                        {busy ? t("분석 중") : t("저장소 분석 →")}
                      </button>
                    </div>
                  </form>
                )}
                <div className="support">
                  JavaScript · TypeScript · Python · Vue · HTML <span> / </span>{" "}
                  fetch · axios · requests · httpx · urllib
                </div>
              </section>
            )}
            {error && !localProgress && (
              <div className="notice error" role="alert">
                <strong>{t("분석 실패")}</strong>
                <p>{t(error)}</p>
                {result && (
                  <small>
                    {t("아래에는 이전 성공 결과를 유지하고 있습니다.")}
                  </small>
                )}
              </div>
            )}
            {result ? (
              <>
                <section className="result-bar">
                  <div>
                    <span className="eyebrow">{t("분석 결과")}</span>
                    <h2>
                      {result.repository.replace("https://github.com/", "")}
                    </h2>
                  </div>
                  <div className="stats">
                    <b>
                      {result.findings.length}
                      <small>{t("호출")}</small>
                    </b>
                    <b>
                      {result.filesScanned}
                      <small>{t("분석 파일")}</small>
                    </b>
                  </div>
                </section>
                <div className="snapshot">
                  {t("커밋")} {result.commit.slice(0, 8)}{" "}
                  {t("· 마지막 성공 분석")}{" "}
                  {new Date(result.analyzedAt).toLocaleString(locale)}
                </div>
                <section className="workspace">
                  <div className="api-list">
                    <div className="panel-title">
                      {t("API 목록")}
                      <span>
                        {groups.length} {t("개 그룹")}
                      </span>
                    </div>
                    {groups.map(([name, items]) => (
                      <div key={name} className="group">
                        <h3>{t(name)}</h3>
                        {items.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => setSelected(f.id)}
                            aria-pressed={active?.id === f.id}
                            className={
                              "api-item " + (selected === f.id ? "chosen" : "")
                            }
                          >
                            <span className="method">{f.method}</span>
                            <strong>{f.address ?? f.operation}</strong>
                            <small>
                              {f.operation} · {f.file}:{f.line}
                            </small>
                            <span
                              className={
                                "live-badge list-live " +
                                (liveResults.get(f.id)?.status ?? "")
                              }
                            >
                              {liveResults.get(f.id)?.httpCode
                                ? "HTTP " + liveResults.get(f.id)!.httpCode
                                : f.method !== "GET" || f.service !== "HTTP"
                                  ? t("자동 조회 제외")
                                  : currentTesting?.phase === "running"
                                    ? t("조회 중")
                                    : liveResults.get(f.id)?.status === "error"
                                      ? t("연결 실패")
                                      : liveResults.get(f.id)?.status ===
                                          "skipped"
                                        ? t("자동 조회 제외")
                                        : currentTesting?.configured
                                          ? t("조회 대기")
                                          : t("설정 필요")}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="detail" aria-live="polite">
                    {active ? (
                      <>
                        <div className="detail-head">
                          <span className="eyebrow">{t("호출 상세")}</span>
                          <span className="pill">
                            {active.resolution === "resolved"
                              ? t("주소 확인")
                              : active.resolution === "internal"
                                ? t("내부 경로 후보")
                                : t("주소 미해결")}
                          </span>
                        </div>
                        <h2>{active.operation}</h2>
                        <p className="service">{active.service}</p>
                        <dl>
                          <dt>{t("호출 주소")}</dt>
                          <dd className="code">
                            {active.address ??
                              t("확인 불가 · 실행 환경 또는 동적 값 필요")}
                          </dd>
                          <dt>{t("주소 구성식 / SDK 작업")}</dt>
                          <dd className="code">{t(active.expression)}</dd>
                          <dt>{t("관련 기능 · 코드의 함수명")}</dt>
                          <dd>{t(active.functionName)}</dd>
                          <dt>{t("호출 파일")}</dt>
                          <dd>
                            <a
                              href={active.codeUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {active.file}:{active.line}:{active.column} ↗
                            </a>
                          </dd>
                          <dt>{t("코드 근거")}</dt>
                          <dd className="code">{t(active.evidence)}</dd>
                        </dl>
                        <div className="actions">
                          <button
                            disabled={
                              !signedIn ||
                              !repositoryId ||
                              active.method !== "GET" ||
                              active.service !== "HTTP"
                            }
                            onClick={() => {
                              setAdvancedOpen(true);
                              checkControls.current?.prepare(active);
                            }}
                          >
                            {t("개별 점검 설정")}
                          </button>
                        </div>
                        <LiveApiResult
                          finding={active}
                          result={liveResults.get(active.id)}
                          configured={Boolean(currentTesting?.configured)}
                          phase={currentTesting?.phase ?? "idle"}
                        />
                      </>
                    ) : (
                      <p>{t("목록에서 API를 선택해 주세요.")}</p>
                    )}
                  </div>
                </section>
                <div className="notes">
                  {result.warnings.map((w) => (
                    <p key={w}>
                      ⓘ{" "}
                      {w ===
                      "코드를 실행하지 않는 정적 분석입니다. 실제 응답 상태를 검증하지 않았습니다."
                        ? t(
                            "코드 분석과 실제 응답 점검은 별개입니다. 응답 상태는 각 API의 점검 결과를 확인하세요.",
                          )
                        : t(w)}
                    </p>
                  ))}
                  <p>
                    {t("제외 파일")} {result.skippedFiles} {t("개 · 파싱 실패")}{" "}
                    {result.parseErrors.length}
                    {t("개")}
                  </p>
                  {result.parseErrors.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              </>
            ) : (
              !busy &&
              !account.busy && (
                <section className="empty">
                  <div className="empty-symbol">⌁</div>
                  <h2>
                    {t(
                      repositoryId
                        ? "분석 결과가 없습니다."
                        : signedIn
                          ? "분석할 저장소를 선택하세요."
                          : "첫 저장소를 분석해 보세요.",
                    )}
                  </h2>
                  <p>
                    {t(
                      repositoryId
                        ? "저장된 성공 결과가 없습니다. 위의 안내를 확인하거나 재분석해 주세요."
                        : signedIn
                          ? "등록된 저장소에서 프로젝트를 선택하거나 새 프로젝트를 추가하세요."
                          : "외부 API를 사용하는 파일과 함수를 찾아 보여드립니다.",
                    )}
                    <br />
                    {t("코드는 내려받아 읽기만 하며 실행하지 않습니다.")}
                  </p>
                  <div className="limits">
                    <span>
                      {t("최대 소스 {count}개").replace(
                        "{count}",
                        String(limits.maxFiles),
                      )}
                    </span>
                    <span>
                      {t("파일당 {count} KiB").replace(
                        "{count}",
                        String(limits.maxFileBytes / 1024),
                      )}
                    </span>
                    <span>
                      {t("총 {count} MiB").replace(
                        "{count}",
                        String(limits.maxTotalBytes / 1024 / 1024),
                      )}
                    </span>
                  </div>
                </section>
              )
            )}
            {signedIn && repositoryId && (
              <details
                className="advanced-checks"
                open={advancedOpen}
                onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
              >
                <summary>{t("개별 점검·정상 응답 기준 (고급)")}</summary>
                <CheckPanel
                  key={repositoryId}
                  repositoryId={repositoryId}
                  controlRef={checkControls}
                />
              </details>
            )}
          </>
        )}

        {view === "history" && (
          <section className="content-card">
            <h2>{t("저장소별 최신 분석")}</h2>
            <p className="muted">
              {t(
                "저장소마다 최신 성공 결과와 최근 시도 상태만 보관합니다. 이전 실행 내역은 누적하지 않습니다.",
              )}
            </p>
            {!signedIn ? (
              <p>{t("분석 기록을 보려면 GitHub으로 로그인하세요.")}</p>
            ) : (
              <>
                <label className="search-field history-search">
                  <span className="sr-only">{t("분석 기록 검색")}</span>
                  <input
                    type="search"
                    placeholder={t("분석 기록 검색")}
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                  />
                </label>
                <div className="history-list">
                  {repos
                    .filter(
                      (r) =>
                        r.latest_status &&
                        r.name
                          .toLowerCase()
                          .includes(historyQuery.toLowerCase()),
                    )
                    .sort((a, b) =>
                      (b.latest_at ?? "").localeCompare(a.latest_at ?? ""),
                    )
                    .map((r) => (
                      <button
                        className="history-row"
                        key={r.id}
                        onClick={() => openRepo(r.id)}
                      >
                        <span>
                          <strong>{r.name}</strong>
                          <small>
                            {r.latest_at
                              ? new Date(r.latest_at).toLocaleString(locale)
                              : "—"}
                          </small>
                        </span>
                        <span className={"project-status " + r.latest_status}>
                          {t(
                            r.latest_status === "success"
                              ? "분석 완료"
                              : r.latest_status === "failed"
                                ? "최근 분석 실패"
                                : "분석 중",
                          )}{" "}
                          →
                        </span>
                      </button>
                    ))}
                  {!repos.some(
                    (r) =>
                      r.latest_status &&
                      r.name.toLowerCase().includes(historyQuery.toLowerCase()),
                  ) && (
                    <p className="project-empty">
                      {t("표시할 분석 기록이 없습니다.")}
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        )}
        {view === "about" && (
          <section className="content-card prose">
            <span className="eyebrow">API OBSERVATORY</span>
            <h2>{t("프로젝트의 외부 연결을 한곳에서")}</h2>
            <p>
              {t(
                "GitHub 저장소에서 외부 API 호출과 관련 파일·함수를 찾아보고, 등록한 점검 주소의 실제 응답을 확인하는 개발 도구입니다.",
              )}
            </p>
            <div className="info-grid">
              <article>
                <h3>{t("코드 분석")}</h3>
                <p>
                  {t(
                    "JavaScript·TypeScript·Vue·HTML 스크립트의 fetch·axios·WebSocket·지원 SDK, Python의 requests·httpx·urllib 호출을 탐지합니다. 내부 API 경로도 표시합니다.",
                  )}
                </p>
              </article>
              <article>
                <h3>{t("API 상태 점검")}</h3>
                <p>
                  {t(
                    "사용자가 등록한 공개 HTTPS 조회 주소를 읽기 전용으로 점검합니다. 예상 HTTP 코드와 JSON 값으로 정상 여부를 판단합니다.",
                  )}
                </p>
              </article>
            </div>
            <h3>{t("지원 범위와 보관 정책")}</h3>
            <p>
              {t("최대 소스 {count}개").replace(
                "{count}",
                String(limits.maxFiles),
              )}{" "}
              ·{" "}
              {t("파일당 {count} KiB").replace(
                "{count}",
                String(limits.maxFileBytes / 1024),
              )}{" "}
              ·{" "}
              {t("총 {count} MiB").replace(
                "{count}",
                String(limits.maxTotalBytes / 1024 / 1024),
              )}
            </p>
            <p>
              {t(
                "HTML은 인라인 JavaScript와 Jinja 조건 블록을 분석합니다. Vue 템플릿, 외부 스크립트 다운로드, Python의 다른 SDK와 파일 간 값 추적은 지원하지 않습니다. 분석 제한 시간은 120초입니다.",
              )}
            </p>
            <p>
              {t(
                "계정별로 저장소와 최신 성공 분석 결과를 보관합니다. 재분석이 실패해도 이전 성공 결과는 유지합니다.",
              )}
            </p>
            <p>
              {t(
                "코드는 실행하지 않으며, 정적 분석만으로 실제 API의 정상 동작이나 보안을 보장하지 않습니다.",
              )}
            </p>
          </section>
        )}
        {view === "help" && (
          <section className="content-card prose">
            <h2>{t("처음 사용하는 방법")}</h2>
            <ol className="help-steps">
              <li>
                <h3>{t("GitHub 로그인")}</h3>
                <p>
                  {t(
                    "오른쪽 위에서 로그인하세요. 같은 계정으로 다른 기기에서도 저장된 프로젝트를 열 수 있습니다.",
                  )}
                </p>
              </li>
              <li>
                <h3>{t("저장소 연결과 등록")}</h3>
                <p>
                  {t(
                    "등록된 저장소 메뉴의 새 프로젝트 추가를 누르세요. 목록이 없다면 계정·GitHub 연결 설정에서 App 설치와 계정 연결을 완료하세요. 비공개 저장소는 App에 접근을 허용해야 합니다.",
                  )}
                </p>
              </li>
              <li>
                <h3>{t("분석 결과 확인")}</h3>
                <p>
                  {t(
                    "저장소를 선택하면 분석 화면이 열립니다. 왼쪽 API 목록에서 호출을 선택해 오른쪽에서 파일과 함수, 주소 구성식을 확인하세요.",
                  )}
                </p>
              </li>
              <li>
                <h3>{t("실제 응답 점검")}</h3>
                <p>
                  {t(
                    "분석 화면 아래에서 점검 주소를 등록하세요. 필요하면 읽기 전용 키와 정상 응답 기준을 설정하고 지금 재점검을 누르세요. 점검 요청이 사용량에 포함될 수 있습니다.",
                  )}
                </p>
              </li>
            </ol>
            <h3>{t("자동 점검과 문제 해결")}</h3>
            <p>
              {t(
                "하루 한 번 자동 점검과 등록 직후 분석은 기본으로 켜져 있으며 계정 설정에서 끌 수 있습니다. 예약 점검은 배포 환경의 예약 작업 설정이 필요합니다.",
              )}
            </p>
            <p>
              {t(
                "탐지 결과가 없으면 지원 언어와 호출 방식을 확인하세요. 주소 미해결은 실행 환경의 값이 필요하다는 뜻입니다. 인증 실패는 키 권한과 만료 여부를 확인하세요.",
              )}
            </p>
          </section>
        )}
        <footer>
          {t(
            "코드에서 확인한 근거를 제공합니다. 미검출은 API가 없다는 뜻이 아닙니다.",
          )}
        </footer>
      </main>
    </div>
  );
}
