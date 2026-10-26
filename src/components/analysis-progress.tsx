"use client";
import {
  analysisStages,
  stageLabels,
  type AnalysisProgress,
} from "@/lib/analysis-progress";
import { useLanguage } from "./language-provider";
export type AnalysisState = {
  latest_status: string;
  reason?: string | null;
  progress?: AnalysisProgress | null;
};
export function AnalysisProgressCard({
  state,
  name,
  onRetry,
  connectionError,
}: {
  state: AnalysisState;
  name?: string;
  onRetry?: () => void;
  connectionError?: string;
}) {
  const { t, locale } = useLanguage();
  const p = state.progress,
    running = state.latest_status === "running",
    failed = state.latest_status === "failed";
  const index = p ? analysisStages.indexOf(p.stage) : 0;
  if (state.latest_status === "success")
    return (
      <section
        className="analysis-complete-summary"
        aria-label={t("분석 진행 상황")}
      >
        <span aria-hidden="true">✓</span>
        <strong>{t("분석 완료")}</strong>
        {name && <span>{name}</span>}
        {p && (
          <small>
            {t("마지막 갱신")}{" "}
            {new Date(p.updatedAt).toLocaleTimeString(locale)}
          </small>
        )}
      </section>
    );
  return (
    <section
      className={
        "analysis-progress-card " +
        (failed ? "failed" : running ? "running" : "complete")
      }
      aria-label={t("분석 진행 상황")}
    >
      <div className="analysis-progress-heading">
        <div>
          <strong>
            {t(running ? "분석 중" : failed ? "분석 실패" : "분석 완료")}
          </strong>
          {name && <span className="muted">{name}</span>}
        </div>
        {failed && onRetry && (
          <button onClick={onRetry}>{t("다시 분석")}</button>
        )}
      </div>
      <p role="status" aria-live="polite">
        {state.latest_status === "success"
          ? t("분석 완료")
          : p
            ? t(stageLabels[p.stage])
            : running
              ? t("분석 준비 중")
              : t("진행 단계 기록 없음")}
        {p?.stage === "reading" && p.total !== null && (
          <>
            {" "}
            ·{" "}
            <b>
              {p.completed} / {p.total}
            </b>{" "}
            {t("개 파일 읽음")}
          </>
        )}
        {failed && p && <> · {t("이 단계에서 중단됨")}</>}
      </p>
      {running && (
        <progress
          aria-label={t(
            p?.stage === "reading" ? "소스 파일 읽기" : "분석 진행 상황",
          )}
          max={p?.stage === "reading" && p.total ? p.total : undefined}
          value={p?.stage === "reading" && p.total ? p.completed : undefined}
        />
      )}
      {p && (
        <ol className="analysis-stage-list">
          {analysisStages.map((stage, i) => (
            <li
              key={stage}
              className={
                state.latest_status === "success" || i < index
                  ? "done"
                  : i === index
                    ? "current"
                    : ""
              }
              aria-current={running && i === index ? "step" : undefined}
            >
              <span aria-hidden="true">
                {state.latest_status === "success" || i < index ? "✓" : i + 1}
              </span>
              {t(stageLabels[stage])}
            </li>
          ))}
        </ol>
      )}
      {failed && (
        <p className="progress-error">
          {t(state.reason || "분석 중 오류가 발생했습니다.")}
        </p>
      )}
      {connectionError && <p role="alert">{t(connectionError)}</p>}
      <small className="muted">
        {running
          ? t("다른 메뉴로 이동해도 분석은 계속됩니다.")
          : failed
            ? t("이전 성공 결과가 있다면 아래에 유지됩니다.")
            : t("최신 분석 결과가 저장되었습니다.")}
        {p && (
          <>
            {" "}
            · {t("마지막 갱신")}{" "}
            {new Date(p.updatedAt).toLocaleTimeString(locale)}
          </>
        )}
      </small>
    </section>
  );
}
