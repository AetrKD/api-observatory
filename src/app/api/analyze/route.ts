import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository, AnalysisError } from "@/lib/github";
export const maxDuration = 180;
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development")
    return NextResponse.json(
      { error: "계정 연결 전 분석은 로컬 개발에서만 사용할 수 있습니다." },
      { status: 403 },
    );
  const host = request.headers.get("host") ?? "";
  if (
    !/^(?:localhost|127\.0\.0\.1):\d+$/.test(host) ||
    request.headers.get("origin") !== "http://" + host
  )
    return NextResponse.json(
      { error: "로컬 화면에서 실행해 주세요." },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length")) > 2048)
    return NextResponse.json({ error: "요청이 너무 큽니다." }, { status: 413 });
  try {
    const body = await request.json();
    if (typeof body?.url !== "string" || body.url.length > 500)
      throw new AnalysisError("저장소 주소를 확인해 주세요.");
    if (request.headers.get("accept") === "application/x-ndjson") {
      const encoder = new TextEncoder();
      let cancelled = false;
      const stream = new ReadableStream({
        async start(controller) {
          const send = (value: unknown) => {
            if (!cancelled)
              controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
          };
          try {
            const result = await analyzeRepository(
              body.url,
              fetch,
              {},
              async (progress) => send({ progress }),
            );
            send({ result });
          } catch (error) {
            send({
              error:
                error instanceof AnalysisError
                  ? error.message
                  : "분석 중 오류가 발생했습니다.",
            });
          } finally {
            if (!cancelled) controller.close();
          }
        },
        cancel() {
          cancelled = true;
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return NextResponse.json(await analyzeRepository(body.url));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof AnalysisError
            ? error.message
            : "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: error instanceof AnalysisError ? error.status : 500 },
    );
  }
}
