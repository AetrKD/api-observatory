import { lookup } from "node:dns/promises";
import { Agent, request } from "undici";
import { checkUrl, publicAddress } from "./policy";
import { AppError } from "../server/http";
export async function resolvePublic(host: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const list = await Promise.race([
      lookup(host, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new AppError("DNS 조회 시간이 초과됐습니다.")),
          5000,
        );
      }),
    ]);
    if (!list.length || list.some((x) => !publicAddress(x.address)))
      throw new AppError("내부망 또는 예약 주소로 연결할 수 없습니다.");
    return list;
  } finally {
    clearTimeout(timer);
  }
}
export async function protectedRequest(
  value: string,
  headers: Record<string, string>,
): Promise<{
  code: number;
  text: string;
  duration: number;
  contentType?: string;
}> {
  const url = checkUrl(value),
    addresses = await resolvePublic(url.hostname),
    pinned = addresses[0];
  const dispatcher = new Agent({
    connect: {
      autoSelectFamily: false,
      lookup: (hostname, _options, callback) => {
        if (hostname !== url.hostname) {
          callback(new Error("Unexpected hostname"), "", 4);
          return;
        }
        callback(null, pinned.address, pinned.family);
      },
    },
  });
  try {
    const start = Date.now(),
      response = await request(url, {
        dispatcher,
        method: "GET",
        headers,
        headersTimeout: 10000,
        bodyTimeout: 10000,
        signal: AbortSignal.timeout(10000),
      });
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response.body) {
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > 256 * 1024) {
        response.body.destroy();
        throw new AppError("응답 본문이 256 KiB 한도를 초과했습니다.");
      }
      chunks.push(bytes);
    }
    return {
      code: response.statusCode,
      contentType:
        typeof response.headers["content-type"] === "string"
          ? response.headers["content-type"]
          : undefined,
      text: Buffer.concat(chunks).toString("utf8"),
      duration: Date.now() - start,
    };
  } finally {
    await dispatcher.close();
  }
}
