import { test } from "node:test";
import assert from "node:assert/strict";
import { responsePreview } from "../src/lib/checks/preview";
import { draftCheck, resolveCheckAddress } from "../src/lib/checks/draft";
import type { Finding } from "../src/lib/types";
test("JSON preview masks sensitive nested fields and the actual credential while retaining useful data", () => {
  const r = responsePreview(
    JSON.stringify({
      status: "ok",
      access_token: "private-token",
      nested: {
        password: "bad",
        items: [{ apiKey: "key", value: "echo unique-secret-value" }],
      },
      "unique-secret-value": "echo",
    }),
    "application/json",
    ["unique-secret-value"],
  );
  assert.equal(r.format, "json");
  assert.equal(r.truncated, false);
  assert.equal(JSON.parse(r.body).status, "ok");
  for (const value of ["private-token", "bad", "unique-secret-value", '"key"'])
    assert.ok(!r.body.includes(value), value);
  assert.equal(JSON.parse(r.body).nested.items[0].apiKey, "[비공개]");
});
test("text previews redact echoed credentials, token patterns and URL authentication", () => {
  const r = responsePreview(
    "Authorization: Bearer abc.def.ghi\npassword=hidden-value\nsecret=echo-value\nhttps://user:pass@example.com?api_key=url-value",
    "text/plain",
    ["echo-value"],
  );
  for (const value of [
    "abc.def.ghi",
    "hidden-value",
    "echo-value",
    "user:pass",
    "url-value",
  ])
    assert.ok(!r.body.includes(value), value);
});
test("preview handles empty, binary and large responses without exposing executable HTML", () => {
  assert.equal(responsePreview("").body, "");
  assert.equal(responsePreview("binary", "image/png").format, "binary");
  const r = responsePreview("x".repeat(40 * 1024), "text/plain");
  assert.equal(r.truncated, true);
  assert.ok(Buffer.byteLength(r.body) <= 16 * 1024);
  const unicode = responsePreview("한🙂".repeat(5000), "text/plain");
  assert.ok(Buffer.byteLength(unicode.body) <= 16 * 1024);
  assert.ok(!unicode.body.includes("\uFFFD"));
  const html = responsePreview("<script>alert(1)</script>", "text/html");
  assert.equal(html.format, "text");
  assert.equal(html.body, "<script>alert(1)</script>");
});
test("drafts only GET HTTP calls and needs a deployment URL for internal routes", () => {
  const f = {
    method: "GET",
    service: "HTTP",
    address: "/api/console/status",
    resolution: "internal",
    operation: "fetch",
  } as Finding;
  const draft = draftCheck(f)!;
  assert.equal(draft.url, "");
  assert.equal(draft.path, "/api/console/status");
  assert.equal(
    resolveCheckAddress(draft.path, "https://my-service.example.com"),
    "https://my-service.example.com/api/console/status",
  );
  for (const base of [
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com?token=value",
  ])
    assert.equal(resolveCheckAddress(draft.path, base), "");
  assert.equal(
    resolveCheckAddress("//other.example/path", "https://example.com"),
    "",
  );
  assert.equal(draftCheck({ ...f, method: "POST" }), null);
  assert.equal(draftCheck({ ...f, method: "WS", service: "WebSocket" }), null);
  assert.equal(
    draftCheck({
      ...f,
      address: "https://example.com/health",
      resolution: "resolved",
    })!.url,
    "https://example.com/health",
  );
});
