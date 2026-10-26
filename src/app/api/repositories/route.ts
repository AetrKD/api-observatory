import { expireAnalyses } from "@/lib/server/analysis-state";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { currentUser, githubPublicToken } from "@/lib/server/auth";
import { body, sameOrigin, json, failure, AppError } from "@/lib/server/http";
import { db, rows, settings } from "@/lib/server/store";
import { repositoryIdentity } from "@/lib/github";
import { repositories as accessible } from "@/lib/github/access";
export async function GET() {
  try {
    const user = await currentUser();
    await expireAnalyses(user.id);
    return json(
      await rows(
        "select r.*,a.latest_status,a.latest_at,a.reason from repositories r left join analyses a on a.repository_id=r.id where r.owner_id=? order by r.created_at desc",
        [user.id],
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const user = await currentUser(),
      input = await body(request);
    let repo:
      | { id: number; full_name: string; html_url: string; private: boolean }
      | undefined;
    if (input.github_id) {
      repo = (await accessible(user.id)).find(
        (r) => r.id === Number(input.github_id),
      );
      if (!repo)
        throw new AppError("선택한 저장소의 접근 권한이 없습니다.", 403);
    } else {
      const id = repositoryIdentity(String(input.url ?? ""));
      const publicToken = await githubPublicToken(user.id);
      const response = await fetch(
        "https://api.github.com/repos/" + id.owner + "/" + id.repo,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "API-Observatory",
            ...(publicToken ? { Authorization: "Bearer " + publicToken } : {}),
          },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok)
        throw new AppError(
          "공개 저장소를 찾지 못했습니다. 비공개 저장소는 GitHub App 목록에서 선택해 주세요.",
        );
      repo = await response.json();
      if (repo?.private)
        throw new AppError("비공개 저장소는 연결 목록에서 선택해 주세요.", 403);
    }
    if (!repo) throw new AppError("저장소를 확인할 수 없습니다.");
    const id = randomUUID();
    const saved = await db().execute({
      sql: "insert into repositories(id,owner_id,github_id,url,name,private) values(?,?,?,?,?,?) on conflict(owner_id,github_id) do update set url=excluded.url,name=excluded.name,private=excluded.private returning *",
      args: [
        id,
        user.id,
        repo.id,
        repo.html_url,
        repo.full_name,
        repo.private ? 1 : 0,
      ],
    });
    const preferences = await settings(user.id);
    return json(
      { repository: saved.rows[0], analyzeOnAdd: preferences.analyze_on_add },
      201,
    );
  } catch (e) {
    return failure(e);
  }
}
