import { responseFormat } from "./accept";
import { checkUrl, headerName, jsonPath } from "./policy";
import { seal } from "./crypto";
import { AppError } from "../server/http";
import type { Check } from "../server/models";
export function validateCheck(
  input: Record<string, unknown>,
  owner: string,
  id: string,
  existing?: Check,
) {
  const label = String(input.label ?? "").trim();
  if (!label || label.length > 100)
    throw new AppError("점검 이름은 1~100자입니다.");
  const url = checkUrl(String(input.url ?? "")).href,
    auth_type = String(input.auth_type ?? "none");
  if (!["none", "bearer", "header"].includes(auth_type))
    throw new AppError("인증 방식을 확인해 주세요.");
  if (
    existing &&
    auth_type !== "none" &&
    new URL(url).origin !== new URL(existing.url).origin &&
    !input.secret
  )
    throw new AppError("전송 대상이 바뀌면 인증 정보를 새로 입력해 주세요.");
  let credential = existing?.credential ?? null;
  const secret = typeof input.secret === "string" ? input.secret : "";
  if (secret) {
    if (secret.length > 4000 || /[\r\n]/.test(secret))
      throw new AppError("인증 정보 형식이 올바르지 않습니다.");
    credential = seal(secret, owner + ":" + id);
  }
  if (auth_type === "none") credential = null;
  else if (!credential)
    throw new AppError("읽기 전용 키 또는 토큰을 입력해 주세요.");
  const header_name =
    auth_type === "header" ? headerName(String(input.header_name ?? "")) : null;
  const expected_code =
    input.expected_code === null ||
    input.expected_code === "" ||
    input.expected_code === undefined
      ? null
      : Number(input.expected_code);
  if (
    expected_code !== null &&
    (!Number.isInteger(expected_code) ||
      expected_code < 100 ||
      expected_code > 599)
  )
    throw new AppError("예상 응답 코드는 100~599 정수입니다.");
  const json_path = input.json_path ? jsonPath(String(input.json_path)) : null;
  let expected_value: unknown = null;
  if (json_path) {
    try {
      expected_value =
        typeof input.expected_value === "string"
          ? JSON.parse(input.expected_value)
          : input.expected_value;
    } catch {
      throw new AppError(
        '예상 JSON 값은 "ok", 1, true, null처럼 입력해 주세요.',
      );
    }
    if (
      expected_value !== null &&
      !["string", "number", "boolean"].includes(typeof expected_value)
    )
      throw new AppError(
        "JSON 예상 값은 문자열·숫자·불리언·null만 지원합니다.",
      );
  }
  return {
    label,
    url,
    auth_type,
    header_name,
    credential,
    response_format: responseFormat(
      input.response_format ?? existing?.response_format,
    ),
    expected_code,
    json_path,
    expected_value,
    enabled: input.enabled !== false,
  };
}
