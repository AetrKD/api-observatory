import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/server/auth";
import { sameOrigin, failure, json } from "@/lib/server/http";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const data = await getAuth().api.signInSocial({
      body: {
        provider: "github",
        callbackURL: "/",
        errorCallbackURL: "/?auth_error=1",
        disableRedirect: true,
      },
      headers: request.headers,
    });
    return json({ url: data.url });
  } catch (e) {
    return failure(e);
  }
}
