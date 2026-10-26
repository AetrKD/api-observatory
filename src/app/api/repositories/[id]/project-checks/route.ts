import type { NextRequest } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { sameOrigin, body, json, failure } from "@/lib/server/http";
import {
  getProjectProfile,
  saveProjectProfile,
  runProjectProbe,
} from "@/lib/checks/project-service";
export const maxDuration = 180;
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: NextRequest, context: Context) {
  try {
    const progressOnly = _request.nextUrl.searchParams.get("progress") === "1";
    const data = await getProjectProfile(
      (await currentUser()).id,
      (await context.params).id,
      progressOnly,
    );
    return json(
      progressOnly
        ? data
          ? { running: data.running, lastError: data.lastError }
          : null
        : data,
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: NextRequest, context: Context) {
  try {
    sameOrigin(request);
    return json(
      await saveProjectProfile(
        (await currentUser()).id,
        (await context.params).id,
        await body(request),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    sameOrigin(request);
    const input = await body(request);
    const result = await runProjectProbe(
      (await currentUser()).id,
      (await context.params).id,
      input.force === true,
    );
    return json(result, result.run ? 200 : 202);
  } catch (e) {
    return failure(e);
  }
}
