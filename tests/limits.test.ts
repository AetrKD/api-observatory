import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRepository } from "../src/lib/github";
import {
  ANALYSIS_LIMITS as limits,
  supportedSource,
} from "../src/lib/analysis-policy";
type File = { path: string; size: number; body?: string };
function fixture(files: File[], onBlob?: () => void) {
  let blobs = 0;
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
        tree: files.map((f, i) => ({
          path: f.path,
          type: "blob",
          sha: String(i),
          size: f.size,
        })),
      };
    else {
      blobs++;
      onBlob?.();
      const file = url.startsWith("https://raw.githubusercontent.com/")
        ? files.find((f) =>
            new URL(url).pathname.endsWith(
              "/" + f.path.split("/").map(encodeURIComponent).join("/"),
            ),
          )!
        : files[Number(url.split("/").pop())];
      const content = file.body ?? 'fetch("https://example.com")';
      if (url.startsWith("https://raw.githubusercontent.com/"))
        return new Response(content);
      data = {
        encoding: "base64",
        size: file.size,
        content: Buffer.from(content).toString("base64"),
      };
    }
    return new Response(JSON.stringify(data));
  }) as typeof fetch;
  return { fetcher, blobs: () => blobs };
}
const run = (m: ReturnType<typeof fixture>) =>
  analyzeRepository("https://github.com/test/project", m.fetcher);
const padded = (n: number) =>
  'fetch("https://example.com");\n//'.padEnd(n, "x");
test("200 source files are accepted; 201 are rejected before downloading blobs", async () => {
  const files = Array.from({ length: 200 }, (_, i) => ({
    path: `src/${i}.ts`,
    size: 40,
  }));
  assert.equal((await run(fixture(files))).filesScanned, 200);
  const over = fixture([...files, { path: "extra.ts", size: 40 }]);
  await assert.rejects(run(over), /지원 한도 초과/);
  assert.equal(over.blobs(), 0);
});
test("400 KiB per-file boundary and decoded body size are enforced", async () => {
  assert.equal(
    (
      await run(
        fixture([
          {
            path: "app.ts",
            size: limits.maxFileBytes,
            body: padded(limits.maxFileBytes),
          },
        ]),
      )
    ).filesScanned,
    1,
  );
  const over = fixture([{ path: "app.ts", size: limits.maxFileBytes + 1 }]);
  await assert.rejects(run(over), /지원 한도 초과/);
  assert.equal(over.blobs(), 0);
  await assert.rejects(
    run(
      fixture([
        { path: "app.ts", size: 40, body: padded(limits.maxFileBytes + 1) },
      ]),
    ),
    /읽은 소스 크기/,
  );
});
test("10 MiB exact total passes while metadata and actual-byte overflow fail", async () => {
  const files: File[] = Array.from({ length: 25 }, (_, i) => ({
    path: `${i}.ts`,
    size: limits.maxFileBytes,
    body: padded(limits.maxFileBytes),
  }));
  const rest = limits.maxTotalBytes - 25 * limits.maxFileBytes;
  files.push({ path: "last.ts", size: rest, body: padded(rest) });
  assert.equal((await run(fixture(files))).filesScanned, 26);
  const over = fixture(
    files.map((f, i) => (i === 25 ? { ...f, size: f.size + 1 } : f)),
  );
  await assert.rejects(run(over), /지원 한도 초과/);
  assert.equal(over.blobs(), 0);
  await assert.rejects(
    run(
      fixture(
        files.map((f, i) => ({
          ...f,
          size: 40,
          body: i === 25 ? padded(rest + 1) : f.body,
        })),
      ),
    ),
    /읽은 소스 크기/,
  );
});
test("reader includes Python and Vue but excludes dependencies and generated sources", async () => {
  for (const path of [
    "venv/a.py",
    ".venv/a.py",
    "src/__pycache__/a.py",
    ".nuxt/a.vue",
    "node_modules/a.vue",
    "x.d.ts",
    "x.d.mts",
    ".env.ts",
  ])
    assert.equal(supportedSource(path), false, path);
  const r = await run(
    fixture([
      {
        path: "app.py",
        size: 60,
        body: 'import requests\nrequests.get("https://example.com/python")',
      },
      {
        path: "App.vue",
        size: 80,
        body: '<script setup>fetch("https://example.com/vue")</script>',
      },
      { path: ".venv/ignore.py", size: 1, body: "invalid" },
    ]),
  );
  assert.equal(r.filesScanned, 2);
  assert.equal(r.skippedFiles, 1);
  assert.deepEqual(
    r.findings.map((f) => f.file).sort(),
    ["App.vue", "app.py"].sort(),
  );
  assert.ok(r.findings.every((f) => f.codeUrl?.includes("#L")));
});
test("120-second deadline is also checked after synchronous parsing", async (t) => {
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  await assert.rejects(
    run(
      fixture([{ path: "app.ts", size: 40 }], () => {
        now += limits.timeoutMs;
      }),
    ),
    /120초/,
  );
});
test("GitHub reader includes HTML inline calls and links to original HTML lines", async () => {
  const r = await run(
    fixture([
      {
        path: "templates/page.html",
        size: 100,
        body: '<script>\nfetch("/api/auth/login",{method:"POST"});\nnew WebSocket(`ws://${location.host}/api/system/ws`);\n</script>',
      },
    ]),
  );
  assert.equal(r.filesScanned, 1);
  assert.equal(r.findings.length, 2);
  assert.deepEqual(
    r.findings.map((f) => f.method),
    ["POST", "WS"],
  );
  assert.ok(r.findings[0].codeUrl?.endsWith("/templates/page.html#L2"));
  assert.ok(r.findings[1].codeUrl?.endsWith("/templates/page.html#L3"));
});
