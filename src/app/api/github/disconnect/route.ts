import type { NextRequest } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/store";
import { sameOrigin, failure, json } from "@/lib/server/http";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const user = await currentUser();
    await db().batch(
      [
        { sql: "delete from connections where owner_id=?", args: [user.id] },
        {
          sql: "update settings set daily_checks_enabled=0 where user_id=?",
          args: [user.id],
        },
      ],
      "write",
    );
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
