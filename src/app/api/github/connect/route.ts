import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { sameOrigin, failure, json } from "@/lib/server/http";
import { required, siteUrl } from "@/lib/server/config";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const user = await currentUser();
    const state = randomBytes(32).toString("hex");
    const jar = await cookies();
    jar.set("apiobs_github_state", user.id + ":" + state, {
      httpOnly: true,
      secure: siteUrl().startsWith("https:"),
      sameSite: "lax",
      path: "/api/github/callback",
      maxAge: 600,
    });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", required("GITHUB_APP_CLIENT_ID"));
    url.searchParams.set("redirect_uri", siteUrl() + "/api/github/callback");
    url.searchParams.set("state", state);
    return json({ url: url.href });
  } catch (e) {
    return failure(e);
  }
}
