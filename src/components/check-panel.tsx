"use client";
import { ResponseFormatSelect } from "./response-format-select";
import { useLanguage } from "./language-provider";
import { useEffect, useState, useImperativeHandle, useRef } from "react";
import { draftCheck, resolveCheckAddress } from "@/lib/checks/draft";
import type { Finding } from "@/lib/types";
import type { ResponsePreview } from "@/lib/checks/preview";
import type { CheckResult } from "@/lib/server/models";
type View = {
  id: string;
  label: string;
  url: string;
  response_format: string;
  auth_type: string;
  header_name: string | null;
  expected_code: number | null;
  json_path: string | null;
  expected_value: unknown;
  enabled: boolean;
  hasCredential: boolean;
  latest_result: CheckResult | null;
};
type Form = {
  label: string;
  url: string;
  response_format: string;
  auth_type: string;
  header_name: string;
  secret: string;
  expected_code: string;
  json_path: string;
  expected_value: string;
  enabled: boolean;
};
const empty: Form = {
  label: "",
  url: "",
  auth_type: "none",
  response_format: "default",
  header_name: "X-API-Key",
  secret: "",
  expected_code: "",
  json_path: "",
  expected_value: '"ok"',
  enabled: true,
};
async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json" },
    }),
    data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "점검 요청 실패");
  return data;
}
export type CheckControls = { prepare: (finding: Finding) => void };
export function CheckPanel({
  repositoryId,
  controlRef,
}: {
  repositoryId: string;
  controlRef?: React.Ref<CheckControls>;
}) {
  const { t, locale } = useLanguage();
  const [items, setItems] = useState<View[]>([]),
    [form, setForm] = useState<Form>(empty),
    [editing, setEditing] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [previews, setPreviews] = useState<
    Record<string, ResponsePreview | null>
  >({});
  const [formOpen, setFormOpen] = useState(false),
    [path, setPath] = useState(""),
    [base, setBase] = useState(""),
    [focusVersion, setFocusVersion] = useState(0);
  const panelRef = useRef<HTMLElement>(null),
    urlRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(controlRef, () => ({
    prepare(finding) {
      if (busy) return;
      const draft = draftCheck(finding);
      if (!draft) return;
      setEditing(null);
      setForm({ ...empty, label: draft.label, url: draft.url });
      setPath(draft.path);
      setBase("");
      setError("");
      setFormOpen(true);
      setFocusVersion((v) => v + 1);
    },
  }));
  useEffect(() => {
    if (!focusVersion) return;
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    urlRef.current?.focus({ preventScroll: true });
  }, [focusVersion]);
  function showRun(
    id: string,
    data: CheckResult & { preview?: ResponsePreview },
  ) {
    const { preview, ...result } = data;
    setPreviews((old) => ({ ...old, [id]: preview ?? null }));
    setItems((old) =>
      old.map((item) =>
        item.id === id ? { ...item, latest_result: result } : item,
      ),
    );
  }
  async function run(id: string) {
    showRun(id, await api("/api/checks/" + id + "/run", { method: "POST" }));
  }
  async function load() {
    setItems(
      await api(
        "/api/checks?repository_id=" + encodeURIComponent(repositoryId),
      ),
    );
  }
  useEffect(() => {
    const abort = new AbortController();
    setItems([]);
    setEditing(null);
    setForm(empty);
    setError("");
    fetch("/api/checks?repository_id=" + encodeURIComponent(repositoryId), {
      signal: abort.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setItems(data);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [repositoryId]);
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "점검 실패");
    } finally {
      setBusy(false);
    }
  }
  function field(key: keyof Form, value: string | boolean) {
    setForm((old) => ({ ...old, [key]: value }));
  }
  return (
    <section className="account-box" id="live-checks" ref={panelRef}>
      <div className="account-heading">
        <div>
          <span className="eyebrow">LIVE API CHECKS</span>
          <h2>{t("등록한 주소 점검")}</h2>
        </div>
        <span className="pill">{t("사용자당 최대 5개")}</span>
      </div>
      <p className="muted">
        {t(
          "읽기 전용으로 발급한 키와 점검용 조회 주소만 등록하세요. 코드 분석과 실제 응답 점검은 별개입니다.",
        )}
      </p>
      {items.map((item) => (
        <article className="check-card" key={item.id}>
          <div className="account-heading">
            <div>
              <strong>{item.label}</strong>
              <p className="code">{item.url}</p>
            </div>
            <span className="pill">
              {item.hasCredential ? t("인증 정보 등록됨") : t("인증 없음")}
            </span>
          </div>
          {item.latest_result ? (
            <div
              className={
                "notice " +
                (item.latest_result.status === "pass" ? "" : "error")
              }
            >
              <strong>
                {item.latest_result.status === "pass"
                  ? t("기준 통과")
                  : item.latest_result.status === "mismatch"
                    ? t("기준 미충족")
                    : t("실행 실패")}
              </strong>
              <p>{t(item.latest_result.reason)}</p>
              <small>
                {new Date(item.latest_result.checkedAt).toLocaleString(locale)}{" "}
                ·{" "}
                {item.latest_result.trigger === "manual"
                  ? t("수동")
                  : t("자동")}{" "}
                · HTTP {item.latest_result.httpCode ?? "—"} ·{" "}
                {item.latest_result.durationMs} ms
              </small>
            </div>
          ) : (
            <p className="muted">{t("아직 점검하지 않았습니다.")}</p>
          )}
          {previews[item.id] && (
            <details className="response-preview" open>
              <summary>{t("응답 본문 미리보기")}</summary>
              <p className="muted">
                {previews[item.id]!.contentType ?? t("응답 형식 미지정")} ·{" "}
                {t(
                  "일부 민감한 필드는 가려집니다. 본문은 서버에 저장하지 않습니다.",
                )}
              </p>
              {previews[item.id]!.format === "binary" ? (
                <p>{t("바이너리 응답은 본문 미리보기를 지원하지 않습니다.")}</p>
              ) : (
                <pre tabIndex={0}>
                  {previews[item.id]!.body || t("응답 본문이 비어 있습니다.")}
                </pre>
              )}
              {previews[item.id]!.truncated && (
                <p>{t("미리보기는 앞부분 16 KiB까지만 표시합니다.")}</p>
              )}
            </details>
          )}
          {item.latest_result && !previews[item.id] && (
            <p className="muted">
              {t("응답 본문은 수동 점검 직후에 확인할 수 있습니다.")}
            </p>
          )}
          <div className="actions">
            <button
              disabled={busy || !item.enabled}
              onClick={() =>
                act(async () => {
                  await run(item.id);
                })
              }
            >
              {busy ? t("점검 중") : t("지금 재점검")}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setEditing(item.id);
                setPath("");
                setBase("");
                setFormOpen(true);
                setForm({
                  label: item.label,
                  url: item.url,
                  auth_type: item.auth_type,
                  response_format: item.response_format ?? "default",
                  header_name: item.header_name ?? "X-API-Key",
                  secret: "",
                  expected_code: item.expected_code?.toString() ?? "",
                  json_path: item.json_path ?? "",
                  expected_value: JSON.stringify(item.expected_value),
                  enabled: item.enabled,
                });
              }}
            >
              {t("설정·키 교체")}
            </button>
            <button
              className="button-danger"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await api("/api/checks/" + item.id, { method: "DELETE" });
                  if (editing === item.id) {
                    setEditing(null);
                    setForm(empty);
                  }
                })
              }
            >
              {t("점검·인증 정보 삭제")}
            </button>
          </div>
        </article>
      ))}
      <details
        open={formOpen}
        onToggle={(e) => setFormOpen(e.currentTarget.open)}
      >
        <summary>
          {editing ? t("선택 점검 설정 수정") : t("새 점검 주소 등록")}
        </summary>
        <form
          className="check-form"
          onSubmit={(e) => {
            e.preventDefault();
            const test =
              (e.nativeEvent as SubmitEvent).submitter instanceof
                HTMLButtonElement &&
              ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)
                .value === "test";
            act(async () => {
              const saved = await api(
                editing ? "/api/checks/" + editing : "/api/checks",
                {
                  method: editing ? "PATCH" : "POST",
                  body: JSON.stringify({
                    ...form,
                    repository_id: repositoryId,
                  }),
                },
              );
              const savedId = editing ?? saved.id;
              setEditing(savedId);
              setForm((old) => ({ ...old, secret: "" }));
              if (test) await run(savedId);
              setEditing(null);
              setForm(empty);
              setPath("");
              setBase("");
              setFormOpen(false);
            });
          }}
        >
          <label>
            {t("점검 이름")}
            <input
              required
              maxLength={100}
              value={form.label}
              onChange={(e) => field("label", e.target.value)}
            />
          </label>
          {path && (
            <div className="check-address-helper">
              <p>
                {t("선택한 내부 API 경로")}: <code>{path}</code>
              </p>
              <label>
                {t("실행 중인 서비스 주소")}
                <input
                  type="url"
                  value={base}
                  onChange={(e) => {
                    setBase(e.target.value);
                    field("url", resolveCheckAddress(path, e.target.value));
                  }}
                  placeholder="https://my-service.example.com"
                />
              </label>
              <small>
                {t(
                  "저장소 주소 대신 실제 배포된 서비스의 공개 HTTPS 주소를 입력하세요.",
                )}
              </small>
            </div>
          )}
          <label>
            {t("공개 HTTPS 조회 주소")}
            <input
              required
              type="url"
              ref={urlRef}
              value={form.url}
              onChange={(e) => field("url", e.target.value)}
              placeholder="https://api.example.com/health"
            />
          </label>
          <ResponseFormatSelect
            value={form.response_format}
            onChange={(value) => field("response_format", value)}
            disabled={busy}
          />
          <label>
            {t("인증 방식")}
            <select
              value={form.auth_type}
              onChange={(e) => field("auth_type", e.target.value)}
            >
              <option value="none">{t("인증 없음")}</option>
              <option value="bearer">{t("Bearer 토큰")}</option>
              <option value="header">{t("API 키 헤더")}</option>
            </select>
          </label>
          {form.auth_type === "header" && (
            <label>
              {t("헤더 이름")}
              <input
                value={form.header_name}
                onChange={(e) => field("header_name", e.target.value)}
              />
            </label>
          )}
          {form.auth_type !== "none" && (
            <label>
              {t("읽기 전용 키·토큰")}
              {editing ? t("(비워두면 기존 값 유지)") : ""}
              <input
                type="password"
                autoComplete="new-password"
                value={form.secret}
                onChange={(e) => field("secret", e.target.value)}
                required={!editing}
              />
            </label>
          )}
          <label>
            {t("예상 HTTP 코드 (비우면 2xx)")}
            <input
              type="number"
              min={100}
              max={599}
              value={form.expected_code}
              onChange={(e) => field("expected_code", e.target.value)}
            />
          </label>
          <label>
            {t("JSON 객체 경로 (선택)")}
            <input
              value={form.json_path}
              onChange={(e) => field("json_path", e.target.value)}
              placeholder="status"
            />
          </label>
          {form.json_path && (
            <label>
              {t("예상 JSON 값")}
              <input
                value={form.expected_value}
                onChange={(e) => field("expected_value", e.target.value)}
              />
              <small>
                {t("문자열은 따옴표를 포함해 입력: &quot;ok&quot;")}
              </small>
            </label>
          )}
          <label>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => field("enabled", e.target.checked)}
            />{" "}
            {t("이 대상 점검 활성화")}
          </label>
          <div className="actions">
            <button disabled={busy || !form.enabled} value="test">
              {busy ? t("점검 중") : t("저장 후 응답 테스트")}
            </button>
            <button disabled={busy} value="save">
              {t("저장")}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm(empty);
                }}
              >
                {t("수정 취소")}
              </button>
            )}
          </div>
        </form>
      </details>
      {error && (
        <p className="notice error" role="alert">
          {t(error)}
        </p>
      )}
      <p className="muted">
        {t(
          "자동 점검을 꺼도 수동 재점검은 가능합니다. 수동 실행은 30초 간격이며 예약 시각을 변경하지 않습니다.",
        )}
      </p>
    </section>
  );
}
