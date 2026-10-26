import { createSign } from "node:crypto";
import { githubPublicToken, type AppUser } from "../server/auth";
import { required } from "../server/config";
import { AppError } from "../server/http";
import { db, one } from "../server/store";
import { seal, unseal, type Sealed } from "../checks/crypto";
import type { Repo } from "../server/models";
export type GitRepo = {
  id: number;
  full_name: string;
  html_url: string;
  private: boolean;
  owner: { id: number };
};
type Connection = { owner_id: string; github_id: string; credential: Sealed };
type Credentials = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
};
export async function github<T>(
  token: string,
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch("https://api.github.com" + endpoint, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "API-Observatory",
      Authorization: "Bearer " + token,
      ...init.headers,
    },
  });
  if (!response.ok)
    throw new AppError(
      [401, 403, 404].includes(response.status)
        ? "GitHub 연결 또는 저장소 접근 권한을 확인해 주세요."
        : "GitHub 요청 제한 또는 일시적 오류입니다.",
      response.status === 429 ? 429 : 403,
    );
  return response.json() as Promise<T>;
}
export function githubIdentity(user: AppUser) {
  return user.githubId;
}
async function exchange(parameters: Record<string, string>) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: required("GITHUB_APP_CLIENT_ID"),
      client_secret: required("GITHUB_APP_CLIENT_SECRET"),
      ...parameters,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok || typeof data.access_token !== "string")
    throw new AppError("GitHub App 승인을 다시 진행해 주세요.", 403);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_in
      ? Date.now() + Number(data.expires_in) * 1000
      : undefined,
  } as Credentials;
}
export async function saveConnection(
  user: AppUser,
  code: string,
  redirectUri: string,
) {
  const credential = await exchange({ code, redirect_uri: redirectUri });
  const profile = await github<{ id: number }>(
    credential.access_token,
    "/user",
  );
  if (String(profile.id) !== githubIdentity(user))
    throw new AppError("로그인한 GitHub 계정과 연결 계정이 다릅니다.", 403);
  await db().execute({
    sql: "insert into connections(owner_id,github_id,credential) values(?,?,?) on conflict(owner_id) do update set github_id=excluded.github_id,credential=excluded.credential",
    args: [
      user.id,
      String(profile.id),
      JSON.stringify(seal(JSON.stringify(credential), user.id + ":github")),
    ],
  });
}
async function userToken(owner: string) {
  const data = await one<Connection & { credential: string }>(
    "select * from connections where owner_id=?",
    [owner],
  );
  if (!data) throw new AppError("GitHub App 연결이 필요합니다.", 409);
  const connection = {
    ...data,
    credential: JSON.parse(data.credential),
  } as Connection;
  let credential = JSON.parse(
    unseal(connection.credential, owner + ":github"),
  ) as Credentials;
  if (credential.expires_at && credential.expires_at < Date.now() + 60000) {
    if (!credential.refresh_token)
      throw new AppError(
        "GitHub App 연결이 만료됐습니다. 다시 연결해 주세요.",
        403,
      );
    credential = await exchange({
      grant_type: "refresh_token",
      refresh_token: credential.refresh_token,
    });
    await db().execute({
      sql: "update connections set credential=? where owner_id=?",
      args: [
        JSON.stringify(seal(JSON.stringify(credential), owner + ":github")),
        owner,
      ],
    });
  }
  const current = await github<{ id: number }>(
    credential.access_token,
    "/user",
  );
  if (String(current.id) !== connection.github_id)
    throw new AppError("GitHub 연결 신원을 확인할 수 없습니다.", 403);
  return { token: credential.access_token, id: connection.github_id };
}
export async function repositories(owner: string) {
  const { token, id } = await userToken(owner);
  const selected: Array<GitRepo & { installation_id: number }> = [];
  for (let page = 1; page <= 10; page++) {
    const installs = await github<{
      installations: Array<{
        id: number;
        account: { id: number; type: string };
        suspended_at: string | null;
      }>;
    }>(token, "/user/installations?per_page=100&page=" + page);
    for (const install of installs.installations) {
      if (
        install.suspended_at ||
        String(install.account.id) !== id ||
        install.account.type !== "User"
      )
        continue;
      for (let p = 1; p <= 20; p++) {
        const response = await github<{ repositories: GitRepo[] }>(
          token,
          "/user/installations/" +
            install.id +
            "/repositories?per_page=100&page=" +
            p,
        );
        selected.push(
          ...response.repositories
            .filter((r) => String(r.owner.id) === id)
            .map((r) => ({ ...r, installation_id: install.id })),
        );
        if (response.repositories.length < 100) break;
        if (p === 20)
          throw new AppError(
            "연결 저장소가 너무 많습니다. GitHub App의 선택 저장소를 줄여 주세요.",
          );
      }
    }
    if (installs.installations.length < 100) break;
  }
  return selected;
}
function appJwt() {
  const now = Math.floor(Date.now() / 1000),
    header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
      "base64url",
    ),
    payload = Buffer.from(
      JSON.stringify({
        iat: now - 60,
        exp: now + 540,
        iss: required("GITHUB_APP_ID"),
      }),
    ).toString("base64url");
  const input = header + "." + payload,
    sign = createSign("RSA-SHA256");
  sign.update(input);
  sign.end();
  return (
    input +
    "." +
    sign
      .sign(required("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n"))
      .toString("base64url")
  );
}
export async function repositoryAccess(owner: string, repo: Repo) {
  const publicAccess = {
    token: repo.private ? undefined : await githubPublicToken(owner),
    allowPrivate: false,
  };
  if (!repo.private && publicAccess.token) return publicAccess;
  try {
    const available = await repositories(owner);
    const match = available.find(
      (r) =>
        r.id === repo.github_id &&
        r.html_url.toLowerCase() === repo.url.toLowerCase(),
    );
    if (!match) {
      if (!repo.private) return publicAccess;
      throw new AppError(
        "이 비공개 저장소의 권한이 해제됐거나 선택되지 않았습니다.",
        403,
      );
    }
    const access = await github<{ token: string }>(
      appJwt(),
      "/app/installations/" + match.installation_id + "/access_tokens",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository_ids: [repo.github_id],
          permissions: { contents: "read" },
        }),
      },
    );
    return { token: access.token, allowPrivate: repo.private };
  } catch (e) {
    if (!repo.private) return publicAccess;
    throw e;
  }
}
