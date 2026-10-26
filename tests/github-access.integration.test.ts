import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/server/store";
import { seal } from "../src/lib/checks/crypto";
import { repositoryAccess } from "../src/lib/github/access";
import type { Repo } from "../src/lib/server/models";
test(
  "public selected repositories reuse read-only App access; unselected public falls back and private stays protected",
  { skip: process.env.RUN_TURSO_TESTS !== "1" },
  async (t) => {
    const owner = "access-fixture-" + randomUUID(),
      now = Date.now(),
      originalToken = process.env.GITHUB_SOURCE_TOKEN;
    delete process.env.GITHUB_SOURCE_TOKEN;
    const realFetch = globalThis.fetch;
    let minted = 0,
      identity = 501;
    t.mock.method(
      globalThis,
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (!url.startsWith("https://api.github.com/"))
          return realFetch(input, init);
        const endpoint = url.slice("https://api.github.com".length);
        let data: unknown;
        if (endpoint === "/user") data = { id: identity };
        else if (endpoint.startsWith("/user/installations?"))
          data = {
            installations: [
              {
                id: 77,
                account: { id: 501, type: "User" },
                suspended_at: null,
              },
            ],
          };
        else if (endpoint.startsWith("/user/installations/77/repositories?"))
          data = {
            repositories: [
              {
                id: 888,
                full_name: "fixture/project",
                html_url: "https://github.com/fixture/project",
                owner: { id: 501 },
                private: false,
              },
            ],
          };
        else if (endpoint === "/app/installations/77/access_tokens") {
          minted++;
          assert.equal(init?.method, "POST");
          assert.deepEqual(JSON.parse(String(init?.body)), {
            repository_ids: [888],
            permissions: { contents: "read" },
          });
          data = { token: "fixture-installation-token" };
        } else throw new Error("Unexpected GitHub request");
        return new Response(JSON.stringify(data));
      },
    );
    try {
      await db().execute({
        sql: "insert into user(id,name,email,emailVerified,createdAt,updatedAt) values(?,?,?,?,?,?)",
        args: [
          owner,
          "access fixture",
          owner + "@example.invalid",
          0,
          now,
          now,
        ],
      });
      await db().execute({
        sql: "insert into connections(owner_id,github_id,credential) values(?,?,?)",
        args: [
          owner,
          "501",
          JSON.stringify(
            seal(
              JSON.stringify({
                access_token: "fixture-user-token",
                expires_at: now + 3600000,
              }),
              owner + ":github",
            ),
          ),
        ],
      });
      const repo: Repo = {
        id: "fixture",
        owner_id: owner,
        github_id: 888,
        url: "https://github.com/fixture/project",
        name: "fixture/project",
        private: false,
        created_at: new Date(now).toISOString(),
      };
      const selected = await repositoryAccess(owner, repo);
      assert.equal(selected.token, "fixture-installation-token");
      assert.equal(selected.allowPrivate, false);
      assert.equal(minted, 1);
      const other = {
        ...repo,
        github_id: 999,
        url: "https://github.com/fixture/other",
      };
      assert.equal((await repositoryAccess(owner, other)).token, undefined);
      assert.equal(minted, 1);
      await assert.rejects(
        repositoryAccess(owner, { ...other, private: true }),
        /권한/,
      );
      assert.equal(minted, 1);
      identity = 999;
      assert.equal((await repositoryAccess(owner, repo)).token, undefined);
      await assert.rejects(
        repositoryAccess(owner, { ...repo, private: true }),
        /신원/,
      );
      assert.equal(minted, 1);
    } finally {
      if (originalToken !== undefined)
        process.env.GITHUB_SOURCE_TOKEN = originalToken;
      else delete process.env.GITHUB_SOURCE_TOKEN;
      await db().execute({ sql: "delete from user where id=?", args: [owner] });
      db().close();
    }
  },
);
