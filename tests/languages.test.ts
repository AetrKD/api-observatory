import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeSources } from "../src/lib/analyzer";
const py = (content: string) => analyzeSources([{ path: "app.py", content }]);
test("Python requests aliases resolve constants, concatenation, function and line", () => {
  const r = py(
    [
      "import requests as req",
      'BASE = "https://api.example.com"',
      "def load():",
      '    return req.get(BASE + "/users")',
    ].join("\n"),
  );
  assert.deepEqual(r.parseErrors, []);
  assert.equal(r.filesScanned, 1);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].address, "https://api.example.com/users");
  assert.equal(r.findings[0].functionName, "load");
  assert.equal(r.findings[0].line, 4);
  assert.equal(r.findings[0].column, 12);
});
test("Python sessions, async httpx clients, base URLs, f-strings and class methods", () => {
  const r = py(
    [
      "import requests",
      "from httpx import AsyncClient as Client",
      'BASE = "https://api.example.com/v1/"',
      "session = requests.Session()",
      'session.post("https://api.example.com/items")',
      "class App:",
      "    async def load(self):",
      "        async with Client(base_url=BASE) as client:",
      '            name = "users"',
      '            return await client.get(f"/{name}")',
    ].join("\n"),
  );
  assert.equal(r.findings.length, 2);
  assert.equal(r.findings[0].method, "POST");
  assert.equal(r.findings[1].address, "https://api.example.com/v1/users");
  assert.equal(r.findings[1].functionName, "App.load");
});
test("Python urllib and directly imported request methods", () => {
  const r = py(
    [
      "from urllib.request import urlopen as open_url, Request",
      "from requests import request as send",
      'open_url(Request("https://example.com/health", method="HEAD"))',
      'send("patch", url="https://example.com/users")',
    ].join("\n"),
  );
  assert.deepEqual(
    r.findings.map((f) => f.method),
    ["HEAD", "PATCH"],
  );
  assert.equal(r.findings[0].address, "https://example.com/health");
});
test("Python local parameters, mutation, loops and reassignment cannot become API imports", () => {
  for (const source of [
    'import requests\ndef f(requests):\n    requests.get("https://example.com")',
    'import requests\nrequests = custom\nrequests.get("https://example.com")',
    'import requests\nrequests += custom\nrequests.get("https://example.com")',
    'import requests\nfor requests in clients:\n    requests.get("https://example.com")',
    'import requests\ndef f():\n    requests.get("https://example.com")\n    requests=custom',
    'import requests\nrequests.get=custom\nrequests.get("https://example.com")',
  ])
    assert.equal(py(source).findings.length, 0, source);
});
test("Python exception aliases, deleted imports and lambda parameters shadow imports", () => {
  for (const s of [
    'import requests\ndel requests\nrequests.get("https://example.com")',
    'import requests\nf=lambda requests: requests.get("https://example.com")',
    'import requests\ntry:\n pass\nexcept Error as requests:\n requests.get("https://example.com")',
  ])
    assert.equal(py(s).findings.length, 0, s);
});
test("Python bare yield is valid while other incomplete expressions still fail", () => {
  const r = py(
    'import requests\nasync def lifespan():\n    yield\n    requests.get("https://example.com")',
  );
  assert.deepEqual(r.parseErrors, []);
  assert.equal(r.findings.length, 1);
  assert.deepEqual(py("import requests\ndef f():\n    x = ").parseErrors, [
    "app.py",
  ]);
});
test("Python dynamic and conditional addresses stay unresolved and credentials never appear", () => {
  const r = py(
    'import requests\nif flag:\n    URL="https://secret.example.com"\nrequests.get(URL,headers={"Authorization":"secret-header"})\nrequests.get("/health?token=secret-value")\nrequests.get("https://u:password@example.com?api_key=secret-value")',
  );
  assert.equal(r.findings[0].resolution, "unresolved");
  assert.equal(r.findings[0].address, null);
  assert.ok(!JSON.stringify(r).includes("secret-header"));
  assert.ok(!JSON.stringify(r).includes("secret-value"));
  assert.ok(!JSON.stringify(r).includes("password@"));
});
test("Python comments and docstrings are not calls; syntax failures are explicit", () => {
  assert.equal(
    py(
      '# requests.get("https://example.com")\n"""requests.get("https://example.com")"""',
    ).findings.length,
    0,
  );
  assert.deepEqual(py("def broken(:\n requests.get(").parseErrors, ["app.py"]);
});
test("Vue script setup TS resolves imported constants and preserves original CRLF positions", () => {
  const r = analyzeSources([
    {
      path: "src/base.ts",
      content: 'export const BASE="https://example.com";',
    },
    {
      path: "src/App.vue",
      content:
        '<template>한글</template>\r\n<script setup lang="ts">\r\nimport {BASE} from "./base";\r\nasync function load(){ return fetch(BASE+"/users"); }\r\n</script>\r\n<style>.x{content:"fetch()"}</style>',
    },
  ]);
  assert.deepEqual(r.parseErrors, []);
  assert.equal(r.findings.length, 1);
  const f = r.findings[0];
  assert.equal(f.file, "src/App.vue");
  assert.equal(f.line, 4);
  assert.equal(f.column, 31);
  assert.equal(f.address, "https://example.com/users");
  assert.equal(r.filesScanned, 2);
});
test("Vue both script blocks may duplicate imports and retain distinct source positions", () => {
  const source =
    '<script>import axios from "axios"; axios.get("https://example.com/a");</script>\n<script setup>import axios from "axios"; axios.get("https://example.com/b");</script>';
  const r = analyzeSources([{ path: "App.vue", content: source }]);
  assert.deepEqual(r.parseErrors, []);
  assert.equal(r.filesScanned, 1);
  assert.deepEqual(
    r.findings.map((f) => f.line),
    [1, 2],
  );
  assert.deepEqual(
    r.findings.map((f) => f.file),
    ["App.vue", "App.vue"],
  );
  assert.equal(new Set(r.findings.map((f) => f.id)).size, 2);
  assert.ok(!JSON.stringify(r.findings).includes("#script-setup"));
});
test("Vue template calls are excluded and malformed scripts do not hide valid Python calls", () => {
  const r = analyzeSources([
    {
      path: "Template.vue",
      content: '<template>{{ fetch("https://example.com") }}</template>',
    },
    { path: "Bad.vue", content: "<script setup>const x = ;</script>" },
    {
      path: "app.py",
      content: 'import requests\nrequests.get("https://example.com")',
    },
  ]);
  assert.deepEqual(r.parseErrors, ["Bad.vue"]);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].file, "app.py");
  assert.equal(r.filesScanned, 2);
});
test("Python urllib dynamic Request objects do not claim a known HTTP method", () => {
  const r = py("from urllib.request import urlopen\nurlopen(request_object)");
  assert.equal(r.findings[0].method, "UNKNOWN");
  assert.equal(r.findings[0].address, null);
});
