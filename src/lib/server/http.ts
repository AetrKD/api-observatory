import { NextRequest, NextResponse } from "next/server";
import { siteUrl } from "./config";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function sameOrigin(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(siteUrl()).origin)
    throw new AppError("요청 출처가 일치하지 않습니다.", 403);
}
export async function body(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("입력값이 없습니다.");
  let total = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > 8192) {
      await reader.cancel();
      throw new AppError("입력값이 너무 큽니다.", 413);
    }
    parts.push(value);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw 0;
    return parsed;
  } catch {
    throw new AppError("입력 형식을 확인해 주세요.");
  }
}
export function failure(error: unknown) {
  const known = error instanceof AppError;
  return NextResponse.json(
    {
      error: known
        ? error.message
        : error instanceof Error && error.message.startsWith("CONFIG:")
          ? "서비스 연결 설정이 필요합니다."
          : "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
    },
    {
      status: known ? error.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", Pragma: "no-cache" },
  });
}
