import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { required } from "@/lib/server/config";
import { json, failure, AppError } from "@/lib/server/http";
import { rows } from "@/lib/server/store";
import { runCheck } from "@/lib/checks/service";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function GET(request: NextRequest) {
  try {
    const expected = Buffer.from("Bearer " + required("CRON_SECRET")),
      actual = Buffer.from(request.headers.get("authorization") ?? "");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      throw new AppError("예약 실행 인증이 필요합니다.", 401);
    const items = await rows<{ id: string; owner_id: string }>(
      "select c.id,c.owner_id from checks c join settings s on s.user_id=c.owner_id where c.enabled=1 and s.daily_checks_enabled=1 order by c.id limit 20",
    );
    const deadline = Date.now() + 150000;
    let index = 0,
      completed = 0,
      failed = 0,
      skipped = 0;
    async function worker() {
      while (index < items.length && Date.now() < deadline) {
        const item = items[index++];
        try {
          const result = await runCheck(item.owner_id, item.id, "scheduled");
          if (result) completed++;
          else skipped++;
        } catch {
          failed++;
        }
      }
    }
    await Promise.all([worker(), worker()]);
    return json({
      completed,
      failed,
      skipped,
      notStarted: items.length - index,
    });
  } catch (e) {
    return failure(e);
  }
}
