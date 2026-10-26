import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/server/auth";
import { sameOrigin, failure } from "@/lib/server/http";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    return await getAuth().api.signOut({
      headers: request.headers,
      asResponse: true,
    });
  } catch (e) {
    return failure(e);
  }
}
