import { after, type NextRequest } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { sameOrigin, json, failure } from "@/lib/server/http";
import { ownedRepo, snapshot } from "@/lib/server/store";
import { repositoryAccess } from "@/lib/github/access";
import { prepareAnalysis } from "@/lib/server/analysis-service";
export const maxDuration = 180;
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: NextRequest, context: Context) {
  try {
    const user = await currentUser(),
      { id } = await context.params,
      repo = await ownedRepo(user.id, id);
    const progressOnly = _request.nextUrl.searchParams.get("progress") === "1";
    if (!progressOnly && repo.private) await repositoryAccess(user.id, repo);
    const data = await snapshot(user.id, id);
    if (!data) return json(null);
    if (progressOnly)
      return json({
        latest_status: data.latest_status,
        reason: data.reason,
        progress: data.progress,
      });
    const { lease_id, lease_until, ...view } = data;
    void lease_id;
    void lease_until;
    return json(view);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    sameOrigin(request);
    const user = await currentUser(),
      { id } = await context.params;
    const execute = await prepareAnalysis(user.id, id);
    after(async () => {
      try {
        await execute();
      } catch {
        /* Failure is persisted; expired leases cover database interruptions. */
      }
    });
    return json({ status: "running" }, 202);
  } catch (e) {
    return failure(e);
  }
}
