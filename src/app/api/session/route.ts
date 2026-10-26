import { currentUser } from "@/lib/server/auth";
import { setupStatus, configured } from "@/lib/server/config";
import { one } from "@/lib/server/db";
import { json } from "@/lib/server/http";
export async function GET() {
  const missing = setupStatus();
  let databaseReady = false;
  try {
    databaseReady = Boolean(await one("select 1 as ok"));
  } catch {}
  if (!configured()) return json({ user: null, missing, databaseReady });
  try {
    const user = await currentUser();
    return json({
      user: { id: user.id, email: user.email },
      missing,
      databaseReady,
      installationUrl: process.env.GITHUB_APP_SLUG
        ? "https://github.com/apps/" +
          encodeURIComponent(process.env.GITHUB_APP_SLUG) +
          "/installations/new"
        : null,
    });
  } catch {
    return json({ user: null, missing, databaseReady });
  }
}
