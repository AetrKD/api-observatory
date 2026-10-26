"use client";
import { useLanguage } from "./language-provider";
import { useEffect, useMemo, useRef, useState } from "react";
export type ConnectedRepository = {
  id: number;
  full_name: string;
  private: boolean;
};
const PAGE_SIZE = 8;
export function RepositoryPicker({
  open,
  repositories,
  registeredIds,
  registeredNames,
  loading,
  busy,
  error,
  onClose,
  onRefresh,
  onAdd,
}: {
  open: boolean;
  repositories: ConnectedRepository[];
  registeredIds: Set<number>;
  registeredNames: Set<string>;
  loading: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onRefresh: () => void;
  onAdd: (id: number) => void;
}) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState(""),
    [visibility, setVisibility] = useState("all"),
    [page, setPage] = useState(0);
  useEffect(() => {
    if (open) {
      setQuery("");
      setVisibility("all");
      setPage(0);
      if (!dialog.current?.open) dialog.current?.showModal();
    } else dialog.current?.close();
  }, [open]);
  const filtered = useMemo(
    () =>
      repositories.filter(
        (repo) =>
          repo.full_name
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()) &&
          (visibility === "all" ||
            (visibility === "private" ? repo.private : !repo.private)),
      ),
    [repositories, query, visibility],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
    current = Math.min(page, pages - 1),
    visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  return (
    <dialog
      ref={dialog}
      className="repository-dialog"
      aria-labelledby="repository-picker-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="picker-heading">
        <div>
          <span className="eyebrow">GITHUB REPOSITORIES</span>
          <h2 id="repository-picker-title">{t("GitHub에서 프로젝트 추가")}</h2>
        </div>
        <button
          type="button"
          className="icon-close"
          aria-label={t("저장소 선택창 닫기")}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <p className="muted">
        {t(
          "GitHub App에서 접근을 허용한 저장소입니다. 필요한 프로젝트만 추가하세요.",
        )}
      </p>
      <div className="picker-filters">
        <label className="search-field">
          <span className="sr-only">{t("GitHub 저장소 검색")}</span>
          <input
            autoFocus
            type="search"
            placeholder={t("저장소 이름으로 검색")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          <span className="sr-only">{t("저장소 공개 범위")}</span>
          <select
            value={visibility}
            onChange={(e) => {
              setVisibility(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">{t("전체 공개 범위")}</option>
            <option value="private">{t("비공개만")}</option>
            <option value="public">{t("공개만")}</option>
          </select>
        </label>
        <button type="button" disabled={loading || busy} onClick={onRefresh}>
          {t("새로고침")}
        </button>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {t(error)}
        </div>
      )}
      <div className="picker-count" role="status">
        {loading
          ? t("저장소를 불러오는 중")
          : filtered.length + " " + t("개 저장소") + ""}
      </div>
      <div className="picker-list" aria-busy={loading}>
        {!loading &&
          visible.map((repo) => {
            const registered =
              registeredIds.has(Number(repo.id)) ||
              registeredNames.has(repo.full_name.toLocaleLowerCase());
            return (
              <div className="picker-row" key={repo.id}>
                <div className="picker-repository">
                  <strong>{repo.full_name}</strong>
                  <span className="visibility-badge">
                    {repo.private ? t("비공개") : t("공개")}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busy || registered}
                  onClick={() => onAdd(repo.id)}
                  aria-label={
                    registered
                      ? repo.full_name + " " + t("이미 등록됨")
                      : repo.full_name + " " + t("추가")
                  }
                >
                  {registered ? t("등록됨") : t("추가")}
                </button>
              </div>
            );
          })}
        {!loading && !filtered.length && (
          <div className="picker-empty">
            <strong>
              {repositories.length
                ? t("검색 결과가 없습니다.")
                : t("연결된 저장소가 없습니다.")}
            </strong>
            <p className="muted">
              {repositories.length
                ? t("다른 이름이나 공개 범위로 검색해 주세요.")
                : t(
                    "GitHub App에서 계정 연결과 저장소 접근 권한을 확인해 주세요.",
                  )}
            </p>
          </div>
        )}
      </div>
      <div className="picker-footer">
        <span className="muted">
          {t("추가한 프로젝트만 기본 화면에 표시됩니다.")}
        </span>
        <div className="pagination">
          <button
            type="button"
            disabled={loading || current === 0}
            onClick={() => setPage(current - 1)}
            aria-label={t("저장소 이전 페이지")}
          >
            ←
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            type="button"
            disabled={loading || current >= pages - 1}
            onClick={() => setPage(current + 1)}
            aria-label={t("저장소 다음 페이지")}
          >
            →
          </button>
        </div>
      </div>
    </dialog>
  );
}
