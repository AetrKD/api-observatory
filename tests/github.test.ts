import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRepository, repositoryIdentity } from "../src/lib/github";
test("rejects credentials, foreign hosts and ambiguous repository URLs", () => {
  for (const x of [
    "http://github.com/a/b",
    "https://example.com/a/b",
    "https://github.com/a/b/tree/main",
    "https://x:y@github.com/a/b",
    "https://github.com/a/b?x=1",
  ])
    assert.throws(() => repositoryIdentity(x));
  assert.equal(repositoryIdentity("https://github.com/a/b.git").repo, "b");
});
function stub(
  extra: {
    truncated?: boolean;
    count?: number;
    private?: boolean;
    source?: string;
  } = {},
) {
  const calls: string[] = [];
  const handler = async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://raw.githubusercontent.com/"))
      return new Response(extra.source ?? 'fetch("https://api.example.com");');
    let data: unknown;
    if (url.endsWith("/repos/test/project"))
      data = { private: extra.private ?? false, default_branch: "main" };
    else if (url.includes("/git/ref/"))
      data = { object: { sha: "commit-fixed" } };
    else if (url.includes("/git/commits/"))
      data = { tree: { sha: "tree-fixed" } };
    else if (url.includes("/git/trees/"))
      data = {
        truncated: extra.truncated ?? false,
        tree: Array.from({ length: extra.count ?? 1 }, (_, i) => ({
          path: "src/file" + i + ".ts",
          sha: "blob" + i,
          type: "blob",
          size: 100,
        })),
      };
    else
      data = {
        encoding: "base64",
        size: 100,
        content: Buffer.from(
          extra.source ?? 'fetch("https://api.example.com");',
        ).toString("base64"),
      };
    return new Response(JSON.stringify(data));
  };
  return { calls, fetcher: handler as typeof fetch };
}
test("pins source and links to one commit", async () => {
  const m = stub();
  const r = await analyzeRepository(
    "https://github.com/test/project",
    m.fetcher,
  );
  assert.equal(r.commit, "commit-fixed");
  assert.match(r.findings[0].codeUrl!, /blob\/commit-fixed\/src/);
  assert.ok(m.calls.some((x) => x.includes("/git/trees/tree-fixed")));
});
test("truncated and over-limit repositories fail rather than claim completeness", async () => {
  for (const config of [
    { truncated: true },
    { count: 201 },
    { private: true },
  ]) {
    const m = stub(config);
    await assert.rejects(() =>
      analyzeRepository("https://github.com/test/project", m.fetcher),
    );
  }
});
test("no matches produce a reason, not a claim of no APIs", async () => {
  const m = stub({ source: "export const x=1;" });
  await assert.rejects(
    () => analyzeRepository("https://github.com/test/project", m.fetcher),
    /API가 없다는 뜻은 아닙니다/,
  );
});

test("repositories without supported source files explain the language limit", async () => {
  const m = stub({ count: 0 });
  await assert.rejects(
    () => analyzeRepository("https://github.com/test/project", m.fetcher),
    /JavaScript·TypeScript/,
  );
  assert.ok(!m.calls.some((url) => url.includes("/git/blobs/")));
});

test("public raw downloads stay pinned, encode paths, omit tokens and use four REST calls for 103 files", async () => {
  const api = stub({ count: 103 });
  let raw = 0,
    rest = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://raw.githubusercontent.com/")) {
      raw++;
      assert.ok(url.includes("/commit-fixed/src/file"));
      assert.equal(new Headers(init?.headers).has("authorization"), false);
      assert.equal(init?.redirect, "error");
    } else rest++;
    return api.fetcher(input, init);
  }) as typeof fetch;
  const result = await analyzeRepository(
    "https://github.com/test/project",
    fetcher,
    { token: "fixture-token" },
  );
  assert.equal(result.filesScanned, 103);
  assert.equal(rest, 4);
  assert.equal(raw, 103);
});
test("private downloads never go through public raw and keep scoped credentials", async () => {
  const api = stub({ private: true });
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(new URL(String(input)).hostname, "api.github.com");
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer fixture-private-token",
    );
    return api.fetcher(input, init);
  }) as typeof fetch;
  assert.equal(
    (
      await analyzeRepository("https://github.com/test/project", fetcher, {
        token: "fixture-private-token",
        allowPrivate: true,
      })
    ).filesScanned,
    1,
  );
});
test("public raw errors remain failures and do not retry every file through REST", async () => {
  const api = stub();
  for (const status of [404, 429, 500]) {
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).startsWith("https://raw.githubusercontent.com/")
        ? new Response("error", { status })
        : api.fetcher(input, init)) as typeof fetch;
    await assert.rejects(
      () => analyzeRepository("https://github.com/test/project", fetcher),
      /소스 파일|GitHub 요청 한도/,
    );
  }
});

test("raw source paths and code links encode Unicode, spaces and URL delimiters", async () => {
  const m = stub();
  const file = "src/한 글 #?.ts";
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/git/trees/"))
      return Response.json({
        truncated: false,
        tree: [{ path: file, sha: "blob0", type: "blob", size: 80 }],
      });
    if (url.startsWith("https://raw.githubusercontent.com/")) {
      assert.equal(
        new URL(url).pathname,
        "/test/project/commit-fixed/" +
          file.split("/").map(encodeURIComponent).join("/"),
      );
      assert.equal(new URL(url).search, "");
      assert.equal(new URL(url).hash, "");
    }
    return m.fetcher(input, init);
  }) as typeof fetch;
  const result = await analyzeRepository(
    "https://github.com/test/project",
    fetcher,
  );
  assert.ok(
    result.findings[0].codeUrl?.includes(encodeURIComponent("한 글 #?.ts")),
  );
});
