import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeSources } from "../src/lib/analyzer";
import { htmlScripts, maskHtmlTemplate } from "../src/lib/analyzer/html";
const html = (content: string) =>
  analyzeSources([{ path: "templates/page.html", content }]);
test("HTML inline script retains original CRLF and Unicode source positions", () => {
  const r = html(
    '<!doctype html>\r\n<p>한글🙂</p>\r\n<script>\r\nasync function login(){ return fetch("/api/auth/login",{method:"POST"}); }\r\n</script>',
  );
  assert.deepEqual(r.parseErrors, []);
  assert.equal(r.filesScanned, 1);
  assert.equal(r.findings.length, 1);
  const f = r.findings[0];
  assert.equal(f.file, "templates/page.html");
  assert.equal(f.line, 4);
  assert.equal(f.column, 32);
  assert.equal(f.functionName, "login");
  assert.equal(f.method, "POST");
  assert.equal(f.address, "/api/auth/login");
  assert.equal(f.resolution, "internal");
});
test("Jinja admin branches preserve scopes and find calls in every possible branch", () => {
  const code = [
    '{% extends "base.html" %}',
    "<script>",
    "async function controls(){",
    "{% if is_admin %}",
    'const res=await fetch("/api/console/start",{method:"POST"});',
    "{% elif is_operator %}",
    'const res=await fetch("/api/console/stop",{method:"POST"});',
    "{% else %}",
    'const res=await fetch("/api/console/status");',
    "{% endif %}",
    "}",
    "</script>",
  ].join("\n");
  const r = html(code);
  assert.deepEqual(r.parseErrors, []);
  assert.deepEqual(
    r.findings.map((f) => f.line),
    [5, 7, 9],
  );
  assert.deepEqual(
    r.findings.map((f) => f.method),
    ["POST", "POST", "GET"],
  );
  const scripts = htmlScripts({ path: "page.html", content: code });
  assert.equal(scripts[0].content.length, code.indexOf("</script>"));
  assert.equal(
    maskHtmlTemplate("{% if x %}\r\n{{ value }}\r\n{% endif %}").split("\r\n")
      .length,
    3,
  );
});
test("HTML ignores commented, JSON, external, template and non-JS scripts", () => {
  const r = html(
    '<!-- <script>fetch("/comment")</script> --><script type="application/ld+json">{"example":"fetch"}</script><script src="/third-party.js">fetch("/external")</script><template><script>fetch("/inert")</script></template><script type="text/plain">fetch("/text")</script><script type="module">fetch("/real")</script>',
  );
  assert.deepEqual(r.parseErrors, []);
  assert.deepEqual(
    r.findings.map((f) => f.address),
    ["/real"],
  );
});
test("Jinja values and templated URL branches remain unresolved and do not expose credentials", () => {
  const r = html(
    '<script>fetch("/api/{{ id }}?token=secret-value");fetch({{ endpoint | tojson }});fetch("/api/{% if x %}a{% else %}b{% endif %}");new WebSocket(`ws://${location.host}/api/{{ id }}`);</script>',
  );
  assert.deepEqual(r.parseErrors, []);
  assert.equal(r.findings.length, 4);
  assert.ok(
    r.findings.every(
      (f) => f.address === null && f.resolution === "unresolved",
    ),
  );
  assert.ok(!JSON.stringify(r).includes("secret-value"));
});
test("HTML separate script blocks allow duplicate names and retain good results after a bad block", () => {
  const r = html(
    '<script>const x=1; fetch("/a");</script>\n<script>const x=2; fetch("/b");</script>\n<script>const bad=;</script>',
  );
  assert.deepEqual(r.parseErrors, ["templates/page.html"]);
  assert.deepEqual(
    r.findings.map((f) => f.line),
    [1, 2],
  );
  assert.equal(new Set(r.findings.map((f) => f.id)).size, 2);
  assert.ok(!JSON.stringify(r.findings).includes("#html-script-"));
});
test("WebSocket static and current-host URLs are classified without inventing a deployment host", () => {
  const r = html(
    '<script>function init(){new WebSocket(`ws://${location.host}/api/system/ws`);new WebSocket(`wss://${location.host}/api/console/ws`);new WebSocket("wss://user:password@example.com/ws?token=secret");}</script>',
  );
  assert.equal(r.findings.length, 3);
  assert.deepEqual(
    r.findings.map((f) => f.method),
    ["WS", "WS", "WS"],
  );
  assert.deepEqual(
    r.findings.map((f) => f.resolution),
    ["internal", "internal", "resolved"],
  );
  assert.deepEqual(
    r.findings.slice(0, 2).map((f) => f.address),
    ["/api/system/ws", "/api/console/ws"],
  );
  assert.ok(!JSON.stringify(r).includes("password"));
  assert.ok(!JSON.stringify(r).includes("secret"));
});
test("Shadowed browser APIs and dynamic hosts cannot become trusted WebSocket addresses", () => {
  const r = html(
    '<script>function local(WebSocket){new WebSocket("wss://example.com")};function host(location){new WebSocket(`ws://${location.host}/api/ws`)};new WebSocket(`wss://${server}/ws`);</script>',
  );
  assert.equal(r.findings.length, 2);
  assert.ok(
    r.findings.every(
      (f) => f.address === null && f.resolution === "unresolved",
    ),
  );
});
test("template placeholders cannot bind to real JS variables and ordinary dollar signs remain valid", () => {
  const r = html(
    '<script>const $J$="https://wrong.example.com";fetch({{ endpoint }});fetch("/api/$J$");</script>',
  );
  assert.deepEqual(r.parseErrors, []);
  assert.equal(r.findings[0].address, null);
  assert.equal(r.findings[0].resolution, "unresolved");
  assert.equal(r.findings[1].address, "/api/$J$");
});
