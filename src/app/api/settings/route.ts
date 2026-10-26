import type { NextRequest } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { settings, db } from "@/lib/server/store";
import { sameOrigin, body, json, failure, AppError } from "@/lib/server/http";
export async function GET() {
  try {
    return json(await settings((await currentUser()).id));
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    sameOrigin(request);
    const user = await currentUser(),
      input = await body(request);
    if (
      typeof input.analyze_on_add !== "boolean" ||
      typeof input.daily_checks_enabled !== "boolean"
    )
      throw new AppError("설정값을 확인해 주세요.");
    await settings(user.id);
    await db().execute({
      sql: "update settings set analyze_on_add=?,daily_checks_enabled=? where user_id=?",
      args: [
        input.analyze_on_add ? 1 : 0,
        input.daily_checks_enabled ? 1 : 0,
        user.id,
      ],
    });
    return json(await settings(user.id));
  } catch (e) {
    return failure(e);
  }
}
