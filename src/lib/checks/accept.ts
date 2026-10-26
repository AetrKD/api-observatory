import { AppError } from "../server/http";
export const responseFormats = {
  default: "*/*",
  json: "application/json",
  text: "text/plain",
  html: "text/html",
} as const;
export type ResponseFormat = keyof typeof responseFormats;
export function responseFormat(value: unknown): ResponseFormat {
  if (value === undefined || value === null) return "default";
  if (typeof value !== "string" || !Object.hasOwn(responseFormats, value))
    throw new AppError(
      "응답 형식은 기본값·JSON·텍스트·HTML 중에서 선택해 주세요.",
    );
  return value as ResponseFormat;
}
export function acceptHeader(value: unknown) {
  return responseFormats[responseFormat(value)];
}
