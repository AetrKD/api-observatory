import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRepository } from "../src/lib/github";
import type { AnalysisProgress } from "../src/lib/analysis-progress";
test("progress reports ordered stages and real completed blob counts", async () => {
  const progress: AnalysisProgress[] = [];
  let fetched = 0;
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    let data: unknown;
    if (url.endsWith("/repos/test/project"))
      data = { private: false, default_branch: "main" };
    else if (url.includes("/git/ref/")) data = { object: { sha: "commit" } };
    else if (url.includes("/git/commits/")) data = { tree: { sha: "tree" } };
    else if (url.includes("/git/trees/"))
      data = {
        truncated: false,
        tree: Array.from({ length: 9 }, (_, i) => ({
          type: "blob",
          path: `src/${i}.ts`,
          sha: String(i),
          size: 40,
        })),
      };
    else {
      fetched++;
      if (url.startsWith("https://raw.githubusercontent.com/"))
        return new Response('fetch("https://api.example.com")');
      data = {
        encoding: "base64",
        size: 40,
        content: Buffer.from('fetch("https://api.example.com")').toString(
          "base64",
        ),
      };
    }
    return new Response(JSON.stringify(data));
  }) as typeof fetch;
  await analyzeRepository(
    "https://github.com/test/project",
    fetcher,
    {},
    async (p) => {
      progress.push(p);
      if (p.stage === "reading") assert.equal(p.completed, fetched);
    },
  );
  assert.deepEqual(
    progress.map((p) => p.stage),
    [
      "access",
      "listing",
      "reading",
      "reading",
      "reading",
      "reading",
      "analyzing",
    ],
  );
  assert.deepEqual(
    progress
      .filter((p) => p.stage === "reading")
      .map((p) => [p.completed, p.total]),
    [
      [0, 9],
      [4, 9],
      [8, 9],
      [9, 9],
    ],
  );
});
test("failed repository access never reports later stages", async () => {
  const stages: string[] = [];
  await assert.rejects(
    analyzeRepository(
      "https://github.com/test/project",
      (async () => new Response("{}", { status: 404 })) as typeof fetch,
      {},
      async (p) => {
        stages.push(p.stage);
      },
    ),
  );
  assert.deepEqual(stages, ["access"]);
});
