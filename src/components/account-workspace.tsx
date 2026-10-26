"use client";
import { AnalysisProgressCard, type AnalysisState } from "./analysis-progress";
import { progressAt } from "@/lib/analysis-progress";
import { useLanguage } from "./language-provider";
import { useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { Analysis } from "@/lib/types";
import { RepositoryPicker } from "./repository-picker";
export type Repository = {
  id: string;
  github_id?: number;
  name: string;
  private: boolean;
  latest_status?: string;
  latest_at?: string;
  reason?: string;
};
type Preferences = { analyze_on_add: boolean; daily_checks_enabled: boolean };
type Session = {
  user: { id: string; name: string } | null;
  missing: string[];
  databaseReady?: boolean;
  installationUrl?: string;
};
class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(data.error ?? "요청 실패", response.status);
  return data;
}
export type AccountControls = {
  login: () => void;
  logout: () => void;
  open: (id: string) => void;
};
export function AccountWorkspace({
  onAnalysis,
  onRepository,
  onSignedIn,
  onRepositories,
  onAccount,
  controlRef,
  view,
  onOpenAnalysis,
}: {
  onAnalysis: (analysis: Analysis | null) => void;
  onRepository: (id: string | null) => void;
  onSignedIn: (active: boolean) => void;
  onRepositories: (repos: Repository[]) => void;
  onAccount: (state: {
    name: string;
    ready: boolean;
    error: string;
    busy: boolean;
  }) => void;
  controlRef: React.Ref<AccountControls>;
  view: string;
  onOpenAnalysis: () => void;
}) {
  const { t } = useLanguage();
  const [session, setSession] = useState<Session | null>(null),
    [repos, setRepos] = useState<Repository[]>([]),
    [prefs, setPrefs] = useState<Preferences>({
      analyze_on_add: true,
      daily_checks_enabled: true,
    }),
    [selected, setSelected] = useState<string | null>(null),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [remote, setRemote] = useState<
      Array<{ id: number; full_name: string; private: boolean }>
    >([]);
  const [pickerOpen, setPickerOpen] = useState(false),
    [remoteLoading, setRemoteLoading] = useState(false),
    [remoteError, setRemoteError] = useState(""),
    [remoteLoaded, setRemoteLoaded] = useState(false),
    [projectQuery, setProjectQuery] = useState(""),
    [projectPage, setProjectPage] = useState(0);
  const filteredProjects = useMemo(
    () =>
      repos.filter((repo) =>
        repo.name
          .toLocaleLowerCase()
          .includes(projectQuery.trim().toLocaleLowerCase()),
      ),
    [repos, projectQuery],
  );
  const projectPages = Math.max(1, Math.ceil(filteredProjects.length / 6)),
    currentProjectPage = Math.min(projectPage, projectPages - 1),
    visibleProjects = filteredProjects.slice(
      currentProjectPage * 6,
      (currentProjectPage + 1) * 6,
    );
  const registeredIds = useMemo(
    () =>
      new Set(
        repos.map((repo) => Number(repo.github_id)).filter(Number.isFinite),
      ),
    [repos],
  );
  const registeredNames = useMemo(
    () => new Set(repos.map((repo) => repo.name.toLocaleLowerCase())),
    [repos],
  );
  async function loadRemote() {
    setRemoteError("");
    setRemoteLoading(true);
    try {
      setRemote(await api("/api/github/repositories"));
      setRemoteLoaded(true);
    } catch (e) {
      setRemoteError(
        e instanceof Error ? e.message : "저장소를 불러오지 못했습니다.",
      );
    } finally {
      setRemoteLoading(false);
    }
  }

  const [analysisState, setAnalysisState] = useState<AnalysisState | null>(
    null,
  );
  const [pollVersion, setPollVersion] = useState(0);
  const [pollError, setPollError] = useState("");
  const analyzing = analysisState?.latest_status === "running";
  useEffect(() => {
    if (!selected || !session?.user) return;
    const id = selected;
    sessionStorage.setItem("analysis-repository:" + session.user.id, id);
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const data = await api(
          "/api/repositories/" + id + "/analysis?progress=1",
          { signal: controller.signal },
        );
        if (!live) return;
        setPollError("");
        setAnalysisState(
          data && ["running", "failed", "success"].includes(data.latest_status)
            ? data
            : null,
        );
        if (data?.latest_status === "running") timer = setTimeout(poll, 1500);
        else {
          const [saved, list] = await Promise.all([
            api("/api/repositories/" + id + "/analysis", {
              signal: controller.signal,
            }),
            api("/api/repositories", { signal: controller.signal }),
          ]);
          if (live) {
            if (saved?.snapshot) onAnalysis(saved.snapshot);
            setRepos(list);
          }
        }
      } catch (e) {
        if (!live) return;
        if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
          setError(e.message);
          setAnalysisState(null);
          onAnalysis(null);
          return;
        }
        setPollError(
          "진행 상태를 불러오지 못했습니다. 연결을 확인하며 자동으로 다시 시도합니다.",
        );
        timer = setTimeout(poll, 5000);
      }
    }
    poll();
    return () => {
      live = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [selected, session?.user?.id, pollVersion, onAnalysis]);
  useEffect(() => {
    onRepositories(repos);
  }, [repos, onRepositories]);
  useEffect(() => {
    onAccount({
      name: session?.user?.name ?? "",
      ready: Boolean(
        session && session.databaseReady && !session.missing.length,
      ),
      busy,
      error,
    });
  }, [session, busy, error, onAccount]);
  useImperativeHandle(controlRef, () => ({ login, logout, open: pick }));
  async function logout() {
    await act(async () => {
      await api("/api/auth/logout", { method: "POST" });

      onAnalysis(null);
      onRepository(null);
      onSignedIn(false);
      setSession((old) => (old ? { ...old, user: null } : null));
      setRepos([]);
      setRemote([]);
      setRemoteLoaded(false);
      setPickerOpen(false);
      setSelected(null);
      setAnalysisState(null);
      setPollError("");
      location.replace("/?signed_out=1");
    });
  }

  useEffect(() => {
    let live = true;
    api("/api/session")
      .then(async (data: Session) => {
        if (!live) return;
        setSession(data);
        onSignedIn(Boolean(data.user));
        if (data.user) {
          const [list, settings] = await Promise.all([
            api("/api/repositories"),
            api("/api/settings"),
          ]);
          if (live) {
            setRepos(list);
            setPrefs(settings);
            const saved = sessionStorage.getItem(
              "analysis-repository:" + data.user.id,
            );
            const restore =
              list.find((r: Repository) => r.id === saved) ??
              list.find((r: Repository) => r.latest_status === "running");
            if (restore) {
              setSelected(restore.id);
              onRepository(restore.id);
            }
          }
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [onSignedIn, onRepository]);
  async function act(work: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리 실패");
    } finally {
      if (session?.user)
        try {
          setRepos(await api("/api/repositories"));
        } catch {}
      setBusy(false);
    }
  }
  async function login() {
    await act(async () => {
      const data = await api("/api/auth/login", { method: "POST" });
      location.href = data.url;
    });
  }
  async function pick(id: string) {
    setSelected(id);
    setAnalysisState(null);
    setPollError("");
    setError("");
    setPollVersion((v) => v + 1);
    onOpenAnalysis();
    onRepository(id);
    onAnalysis(null);
  }
  async function startAnalysis(id: string) {
    await api("/api/repositories/" + id + "/analysis", { method: "POST" });
    setAnalysisState({
      latest_status: "running",
      progress: progressAt("access"),
    });
    setPollVersion((v) => v + 1);
  }
  async function analyze(id: string) {
    await act(() => startAnalysis(id));
  }
  async function register(payload: Record<string, unknown>) {
    await act(async () => {
      const data = await api("/api/repositories", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const id = data.repository.id;

      setSelected(id);
      setAnalysisState(null);
      onOpenAnalysis();
      onRepository(id);
      onAnalysis(null);
      setRepos(await api("/api/repositories"));
      setUrl("");
      setPickerOpen(false);
      setProjectQuery("");
      setProjectPage(0);
      if (data.analyzeOnAdd) {
        await startAnalysis(id);
      }
    });
  }
  return (
    <>
      {analysisState && (analyzing || view === "analysis") && (
        <AnalysisProgressCard
          state={analysisState}
          name={repos.find((r) => r.id === selected)?.name}
          onRetry={selected && !busy ? () => analyze(selected) : undefined}
          connectionError={pollError}
        />
      )}
      {!analysisState && pollError && <p role="alert">{t(pollError)}</p>}
      <section
        className={
          "account-box" +
          (view === "analysis" && selected ? " active-project-box" : "")
        }
        hidden={view !== "analysis" && view !== "repositories"}
      >
        <div className="account-heading workspace-heading">
          <div>
            <span className="eyebrow">{t("워크스페이스")}</span>
            <h2>
              {session?.user ? (
                <>
                  {view === "analysis" && selected
                    ? repos.find((r) => r.id === selected)?.name
                    : t("등록된 저장소")}
                  {!(view === "analysis" && selected) && (
                    <span className="count-badge">{repos.length}</span>
                  )}
                </>
              ) : (
                t("GitHub 계정으로 이어서 사용")
              )}
            </h2>
          </div>
          {session?.user ? (
            <div className="actions">
              {view === "analysis" && selected && (
                <button
                  disabled={busy || analyzing}
                  onClick={() => analyze(selected)}
                >
                  {t("선택 프로젝트 재분석")}
                </button>
              )}
              <button
                className="add-project-button"
                disabled={busy}
                onClick={() => {
                  setPickerOpen(true);
                  if (!remoteLoaded) loadRemote();
                }}
              >
                {t("＋ 새 프로젝트 추가")}
              </button>
            </div>
          ) : (
            <button
              disabled={
                busy ||
                !session ||
                session.missing.includes("GITHUB_CLIENT_ID") ||
                session.missing.includes("GITHUB_CLIENT_SECRET")
              }
              onClick={login}
            >
              {t("GitHub 로그인")}
            </button>
          )}
        </div>
        {!session?.user && (
          <p className="muted">
            {session?.missing.length
              ? t(
                  "GitHub 앱과 로그인 설정이 완료되면 계정별 저장·비공개 저장소를 사용할 수 있습니다.",
                )
              : t(
                  "로그인하면 다른 기기에서도 저장소와 마지막 분석 결과를 확인합니다.",
                )}
          </p>
        )}
        {session?.user && (
          <>
            <div hidden={view !== "repositories"}>
              <div className="project-toolbar">
                <label className="search-field">
                  <span className="sr-only">{t("등록한 프로젝트 검색")}</span>
                  <input
                    type="search"
                    placeholder={t("등록한 프로젝트 검색")}
                    value={projectQuery}
                    onChange={(e) => {
                      setProjectQuery(e.target.value);
                      setProjectPage(0);
                    }}
                  />
                </label>
                <span className="muted">
                  {filteredProjects.length} {t("개 프로젝트")}
                </span>
              </div>
              <div className="project-list">
                {visibleProjects.map((repo) => (
                  <button
                    key={repo.id}
                    className={
                      "project-row" + (selected === repo.id ? " selected" : "")
                    }
                    disabled={busy}
                    onClick={() => pick(repo.id)}
                    aria-pressed={selected === repo.id}
                  >
                    <span className="project-icon" aria-hidden="true">
                      ▤
                    </span>
                    <span className="project-name">
                      <strong>{repo.name}</strong>
                      <span>
                        {repo.private ? t("비공개 저장소") : t("공개 저장소")}
                      </span>
                    </span>
                    <span
                      className={
                        "project-status " + (repo.latest_status ?? "idle")
                      }
                    >
                      {repo.latest_status === "success"
                        ? t("분석 완료")
                        : repo.latest_status === "failed"
                          ? t("최근 분석 실패")
                          : repo.latest_status === "running"
                            ? t("분석 중")
                            : t("미분석")}
                    </span>
                    <span className="project-arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                ))}
                {!filteredProjects.length && (
                  <div className="project-empty">
                    <strong>
                      {projectQuery.trim()
                        ? t("일치하는 프로젝트가 없습니다.")
                        : t("필요한 프로젝트부터 추가해 보세요.")}
                    </strong>
                    <p className="muted">
                      {projectQuery.trim()
                        ? t("검색어를 바꾸면 다른 프로젝트를 찾을 수 있습니다.")
                        : t(
                            "GitHub 저장소를 선택해 추가하면 이곳에서 분석을 이어갈 수 있습니다.",
                          )}
                    </p>
                    {!projectQuery.trim() && (
                      <button
                        disabled={busy}
                        onClick={() => {
                          setPickerOpen(true);
                          if (!remoteLoaded) loadRemote();
                        }}
                      >
                        {t("GitHub에서 프로젝트 선택")}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {projectPages > 1 && (
                <div className="project-pagination">
                  <span className="muted">{t("페이지당 6개씩 표시")}</span>
                  <div className="pagination">
                    <button
                      disabled={busy || currentProjectPage === 0}
                      onClick={() => setProjectPage(currentProjectPage - 1)}
                      aria-label={t("프로젝트 이전 페이지")}
                    >
                      ←
                    </button>
                    <span>
                      {currentProjectPage + 1} / {projectPages}
                    </span>
                    <button
                      disabled={busy || currentProjectPage >= projectPages - 1}
                      onClick={() => setProjectPage(currentProjectPage + 1)}
                      aria-label={t("프로젝트 다음 페이지")}
                    >
                      →
                    </button>
                  </div>
                </div>
              )}
            </div>
            {selected && view !== "analysis" && (
              <div className="selected-project-actions">
                <span className="muted">
                  {repos.find((r) => r.id === selected)?.name}
                </span>
                <button
                  disabled={busy || analyzing}
                  onClick={() => analyze(selected)}
                >
                  {t("선택 프로젝트 재분석")}
                </button>
              </div>
            )}
            {!selected && view === "analysis" && (
              <p className="muted">
                {t("등록된 저장소 메뉴에서 분석할 프로젝트를 선택하세요.")}
              </p>
            )}
            <details className="workspace-settings">
              <summary>{t("계정·GitHub 연결 설정")}</summary>
              <p className="muted">
                {t(
                  "저장소 목록이 보이지 않으면 App 설치 범위와 계정 연결을 확인하세요.",
                )}
              </p>
              <div className="settings-row">
                <label>
                  <input
                    type="checkbox"
                    checked={prefs.analyze_on_add}
                    disabled={busy}
                    onChange={(e) =>
                      act(async () => {
                        const next = {
                          ...prefs,
                          analyze_on_add: e.target.checked,
                        };
                        setPrefs(
                          await api("/api/settings", {
                            method: "PATCH",
                            body: JSON.stringify(next),
                          }),
                        );
                      })
                    }
                  />{" "}
                  {t("등록 직후 자동 분석")}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={prefs.daily_checks_enabled}
                    disabled={busy}
                    onChange={(e) =>
                      act(async () => {
                        const next = {
                          ...prefs,
                          daily_checks_enabled: e.target.checked,
                        };
                        setPrefs(
                          await api("/api/settings", {
                            method: "PATCH",
                            body: JSON.stringify(next),
                          }),
                        );
                      })
                    }
                  />{" "}
                  {t("하루 한 번 API 자동 점검")}
                </label>
              </div>
              <p className="muted">
                {t(
                  "예약 점검은 한국 09시대에 실행되며 정확한 시각은 달라질 수 있습니다.",
                )}
              </p>
              <div className="actions">
                {session.installationUrl && (
                  <a
                    href={session.installationUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("GitHub App 설치·저장소 선택 ↗")}
                  </a>
                )}
                <button
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const data = await api("/api/github/connect", {
                        method: "POST",
                      });
                      location.href = data.url;
                    })
                  }
                >
                  {t("GitHub App 계정 연결")}
                </button>
                <button
                  className="button-danger"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await api("/api/github/disconnect", { method: "POST" });
                      setRemote([]);
                      setRemoteLoaded(false);
                      setPickerOpen(false);

                      onAnalysis(null);
                      onRepository(null);
                      setSelected(null);
                      setAnalysisState(null);
                      setPollError("");
                      setPrefs(await api("/api/settings"));
                    })
                  }
                >
                  {t("App 연결 해제")}
                </button>
              </div>
              <details className="url-add-section">
                <summary>{t("공개 저장소 주소로 추가")}</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    register({ url });
                  }}
                >
                  <label htmlFor="account-repo">
                    {t("공개 GitHub 저장소 주소")}
                  </label>
                  <div className="input-row">
                    <input
                      id="account-repo"
                      type="url"
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://github.com/owner/repository"
                    />
                    <button disabled={busy}>{t("추가")}</button>
                  </div>
                </form>
              </details>
            </details>
            <RepositoryPicker
              open={pickerOpen}
              repositories={remote}
              registeredIds={registeredIds}
              registeredNames={registeredNames}
              loading={remoteLoading}
              busy={busy}
              error={remoteError || error}
              onClose={() => setPickerOpen(false)}
              onRefresh={loadRemote}
              onAdd={(id) => register({ github_id: id })}
            />
          </>
        )}
        {busy && <p role="status">{t("처리 중")}</p>}
      </section>
    </>
  );
}
