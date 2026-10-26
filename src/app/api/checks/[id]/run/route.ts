import type { NextRequest } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { sameOrigin, json, failure } from "@/lib/server/http";
import { runCheck } from "@/lib/checks/service";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    return json(
      await runCheck(
        (await currentUser()).id,
        (await context.params).id,
        "manual",
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
