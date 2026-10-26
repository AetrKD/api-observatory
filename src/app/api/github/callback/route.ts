import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { AppError } from "@/lib/server/http";
import { siteUrl } from "@/lib/server/config";
import { saveConnection } from "@/lib/github/access";
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser(),
      jar = await cookies(),
      expected = jar.get("apiobs_github_state")?.value;
    jar.delete({ name: "apiobs_github_state", path: "/api/github/callback" });
    const state = request.nextUrl.searchParams.get("state"),
      code = request.nextUrl.searchParams.get("code");
    if (!state || !code || expected !== user.id + ":" + state)
      throw new AppError("연결 요청이 만료됐거나 일치하지 않습니다.", 403);
    await saveConnection(user, code, siteUrl() + "/api/github/callback");
    return NextResponse.redirect(siteUrl() + "/?github_connected=1");
  } catch {
    return NextResponse.redirect(siteUrl() + "/?github_error=1");
  }
}
