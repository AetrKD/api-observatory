import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { sameOrigin, body, json, failure, AppError } from "@/lib/server/http";
import {
  db,
  rows,
  ownedRepo,
  decodeCheck,
  checkView,
} from "@/lib/server/store";
import { repositoryAccess } from "@/lib/github/access";
import { validateCheck } from "@/lib/checks/validation";
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser(),
      id = request.nextUrl.searchParams.get("repository_id") ?? "",
      repo = await ownedRepo(user.id, id);
    await repositoryAccess(user.id, repo);
    return json(
      (
        await rows<Record<string, unknown>>(
          "select * from checks where owner_id=? and repository_id=?",
          [user.id, id],
        )
      ).map((x) => checkView(decodeCheck(x))),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const user = await currentUser(),
      input = await body(request),
      repo = await ownedRepo(user.id, String(input.repository_id ?? ""));
    await repositoryAccess(user.id, repo);
    const id = randomUUID(),
      check = validateCheck(input, user.id, id);
    await db().execute({
      sql: "insert into checks(id,owner_id,repository_id,label,url,auth_type,header_name,credential,expected_code,json_path,expected_value,enabled,response_format) values(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [
        id,
        user.id,
        repo.id,
        check.label,
        check.url,
        check.auth_type,
        check.header_name,
        check.credential ? JSON.stringify(check.credential) : null,
        check.expected_code,
        check.json_path,
        JSON.stringify(check.expected_value),
        check.enabled ? 1 : 0,
        check.response_format,
      ],
    });
    return json({ id }, 201);
  } catch (e) {
    if (e instanceof Error && /CHECK_(GLOBAL|USER)_LIMIT/.test(e.message))
      return failure(
        new AppError(
          "점검 한도에 도달했습니다. 사용자당 5개, 서비스 전체 20개까지 지원합니다.",
          409,
        ),
      );
    return failure(e);
  }
}
