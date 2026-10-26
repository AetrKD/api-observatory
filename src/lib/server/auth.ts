import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { headers } from "next/headers";
import { authDb, one } from "./db";
import { required, siteUrl } from "./config";
import { AppError } from "./http";
let instance: ReturnType<typeof createAuth> | undefined;
function createAuth() {
  return betterAuth({
    database: drizzleAdapter(authDb(), { provider: "sqlite" }),
    baseURL: siteUrl(),
    secret: required("BETTER_AUTH_SECRET"),
    socialProviders: {
      github: {
        clientId: required("GITHUB_CLIENT_ID"),
        clientSecret: required("GITHUB_CLIENT_SECRET"),
        scope: ["read:user", "user:email"],
      },
    },
    account: { encryptOAuthTokens: true },
    session: { cookieCache: { enabled: false }, expiresIn: 60 * 60 * 24 * 7 },
    rateLimit: { enabled: true, storage: "database" },
    plugins: [nextCookies()],
  });
}
export type AppUser = {
  id: string;
  email: string;
  githubId: string;
  name?: string;
};
export async function currentUser(): Promise<AppUser> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) throw new AppError("GitHub 로그인이 필요합니다.", 401);
  const identity = await one<{ accountId: string }>(
    "select accountId from account where userId=? and providerId=?",
    [session.user.id, "github"],
  );
  if (!identity) throw new AppError("GitHub 계정 연결을 확인해 주세요.", 403);
  return {
    id: session.user.id,
    email: session.user.email,
    name:
      session.user.name?.trim() && !session.user.name.includes("@")
        ? session.user.name.trim()
        : "GitHub",
    githubId: identity.accountId,
  };
}

export function getAuth() {
  return (instance ??= createAuth());
}

export async function githubPublicToken(
  owner: string,
): Promise<string | undefined> {
  if (process.env.GITHUB_SOURCE_TOKEN) return process.env.GITHUB_SOURCE_TOKEN;
  const account = await one<{ id: string }>(
    "select id from account where userId=? and providerId='github'",
    [owner],
  );
  if (!account) return undefined;
  try {
    const result = await getAuth().api.getAccessToken({
      body: { accountId: account.id, userId: owner },
    });
    return result.accessToken || undefined;
  } catch {
    return undefined;
  }
}
