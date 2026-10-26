import type { NextRequest } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { sameOrigin, body, json, failure, AppError } from "@/lib/server/http";
import { db, ownedCheck, ownedRepo, checkView } from "@/lib/server/store";
import { repositoryAccess } from "@/lib/github/access";
import { validateCheck } from "@/lib/checks/validation";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  try {
    sameOrigin(request);
    const user = await currentUser(),
      { id } = await context.params,
      existing = await ownedCheck(user.id, id);
    await repositoryAccess(
      user.id,
      await ownedRepo(user.id, existing.repository_id),
    );
    const input = await body(request),
      check = validateCheck(input, user.id, id, existing);
    const saved = await db().execute({
      sql: "update checks set label=?,url=?,auth_type=?,header_name=?,credential=?,expected_code=?,json_path=?,expected_value=?,enabled=?,response_format=? where id=? and owner_id=? and (lease_until is null or lease_until<?)",
      args: [
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
        id,
        user.id,
        Date.now(),
      ],
    });
    if (!saved.rowsAffected)
      throw new AppError("점검 실행 중에는 설정을 바꿀 수 없습니다.", 409);
    return json(checkView(await ownedCheck(user.id, id)));
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: NextRequest, context: Context) {
  try {
    sameOrigin(request);
    const user = await currentUser(),
      { id } = await context.params;
    await ownedCheck(user.id, id);
    await db().execute({
      sql: "delete from checks where id=? and owner_id=?",
      args: [id, user.id],
    });
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
