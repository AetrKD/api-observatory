import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { AppError } from "../server/http";
export function publicAddress(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export function checkUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError("유효한 HTTPS 점검 주소가 필요합니다.");
  }
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password ||
    isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
    url.hostname === "localhost" ||
    /\.(localhost|local|internal)$/i.test(url.hostname)
  )
    throw new AppError("공개 HTTPS 주소의 443 포트만 점검할 수 있습니다.");
  if (
    [...url.searchParams.keys()].some((k) =>
      /token|key|secret|password|auth|signature/i.test(k),
    )
  )
    throw new AppError(
      "인증 정보는 주소 쿼리가 아닌 전용 입력란에 등록해 주세요.",
    );
  url.hash = "";
  return url;
}
export function headerName(value: string) {
  if (
    !/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,80}$/.test(value) ||
    /^(host|cookie|connection|content-length|transfer-encoding|forwarded|proxy-|sec-|x-forwarded)/i.test(
      value,
    )
  )
    throw new AppError("이 인증 헤더 이름은 사용할 수 없습니다.");
  return value;
}
export function jsonPath(value: string) {
  if (
    !/^[A-Za-z_][\w-]*(\.[A-Za-z_][\w-]*){0,9}$/.test(value) ||
    value
      .split(".")
      .some((k) => ["__proto__", "prototype", "constructor"].includes(k))
  )
    throw new AppError("JSON 경로는 점으로 구분한 객체 키만 지원합니다.");
  return value;
}
export function evaluate(
  code: number,
  text: string,
  expectedCode: number | null,
  path: string | null,
  expected: unknown,
) {
  if (expectedCode !== null ? code !== expectedCode : code < 200 || code > 299)
    return {
      status: "mismatch" as const,
      reason: "예상 HTTP 상태 코드와 다릅니다.",
    };
  if (path) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        status: "mismatch" as const,
        reason: "응답을 JSON으로 해석할 수 없습니다.",
      };
    }
    for (const key of path.split(".")) {
      if (
        !data ||
        typeof data !== "object" ||
        !Object.prototype.hasOwnProperty.call(data, key)
      )
        return {
          status: "mismatch" as const,
          reason: "지정한 JSON 필드가 없습니다.",
        };
      data = (data as Record<string, unknown>)[key];
    }
    if (data !== expected)
      return {
        status: "mismatch" as const,
        reason: "JSON 필드 값 또는 타입이 예상과 다릅니다.",
      };
  }
  return { status: "pass" as const, reason: "설정한 점검 기준 통과" };
}
