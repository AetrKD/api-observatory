import { responsePreview, type ResponsePreview } from "./preview";
import { randomUUID } from "node:crypto";
import { db, ownedCheck, ownedRepo, one, decodeCheck } from "../server/store";
import { repositoryAccess } from "../github/access";
import { AppError } from "../server/http";
import { unseal } from "./crypto";
import { acceptHeader } from "./accept";
import { evaluate } from "./policy";
import { protectedRequest } from "./request";
import type { CheckResult } from "../server/models";
export async function runCheck(
  owner: string,
  id: string,
  trigger: "manual" | "scheduled",
  transport: typeof protectedRequest = protectedRequest,
) {
  const original = await ownedCheck(owner, id),
    repo = await ownedRepo(owner, original.repository_id);
  await repositoryAccess(owner, repo);
  const lease = randomUUID(),
    now = Date.now(),
    day = new Date(now).toISOString().slice(0, 10);
  const row = await db().execute({
    sql: "update checks set lease_id=?,lease_until=?,last_manual_at=case when ?='manual' then ? else last_manual_at end,last_claimed_day=case when ?='scheduled' then ? else last_claimed_day end where id=? and owner_id=? and enabled=1 and (lease_until is null or lease_until<?) and (?!='manual' or last_manual_at is null or last_manual_at<=?) and (?!='scheduled' or ((last_claimed_day is null or last_claimed_day!=?) and exists(select 1 from settings where user_id=? and daily_checks_enabled=1))) returning *",
    args: [
      lease,
      now + 60000,
      trigger,
      now,
      trigger,
      day,
      id,
      owner,
      now,
      trigger,
      now - 30000,
      trigger,
      day,
      owner,
    ],
  });
  if (!row.rows.length) {
    if (trigger === "scheduled") return null;
    throw new AppError(
      "이미 점검 중이거나 비활성화됐습니다. 수동 점검은 30초 간격으로 실행해 주세요.",
      409,
    );
  }
  const check = decodeCheck(row.rows[0] as unknown as Record<string, unknown>);
  let result: CheckResult;
  let preview: ResponsePreview | undefined;
  const secrets: string[] = [];
  const started = Date.now();
  try {
    if (trigger === "scheduled") {
      const settings = await one<{ daily_checks_enabled: number }>(
        "select daily_checks_enabled from settings where user_id=?",
        [owner],
      );
      if (!settings?.daily_checks_enabled) {
        await db().execute({
          sql: "update checks set lease_id=null,lease_until=null where id=? and lease_id=?",
          args: [id, lease],
        });
        return null;
      }
    }
    const headers: Record<string, string> = {
      "User-Agent": "API-Observatory-Check",
      Accept: acceptHeader(check.response_format),
    };
    if (check.auth_type !== "none") {
      if (!check.credential) throw new AppError("점검 인증 정보가 없습니다.");
      const secret = unseal(check.credential, owner + ":" + id);
      secrets.push(secret);
      if (/[\r\n]/.test(secret))
        throw new AppError("인증 정보 형식이 올바르지 않습니다.");
      headers[
        check.auth_type === "bearer" ? "Authorization" : check.header_name!
      ] = check.auth_type === "bearer" ? "Bearer " + secret : secret;
    }
    const response = await transport(check.url, headers);
    if (trigger === "manual")
      preview = responsePreview(
        response.text,
        response.contentType ?? null,
        secrets,
      );
    result = {
      ...evaluate(
        response.code,
        response.text,
        check.expected_code,
        check.json_path,
        check.expected_value,
      ),
      httpCode: response.code,
      durationMs: response.duration,
      checkedAt: new Date().toISOString(),
      trigger,
    };
  } catch (e) {
    result = {
      status: "error",
      reason:
        e instanceof AppError
          ? e.message
          : "연결 오류 또는 제한 시간 내 응답 없음",
      httpCode: null,
      durationMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      trigger,
    };
  }
  const finish = await db().execute({
    sql: "update checks set latest_result=?,lease_id=null,lease_until=null where id=? and owner_id=? and lease_id=?",
    args: [JSON.stringify(result), id, owner, lease],
  });
  if (!finish.rowsAffected)
    throw new AppError("점검 결과를 저장하지 못했습니다.", 503);
  return preview ? { ...result, preview } : result;
}
