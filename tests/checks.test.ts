import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publicAddress,
  checkUrl,
  headerName,
  jsonPath,
  evaluate,
} from "../src/lib/checks/policy";
import { seal, unseal } from "../src/lib/checks/crypto";
import { validateCheck } from "../src/lib/checks/validation";
test("SSRF policy rejects private, mapped and reserved addresses", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "203.0.113.1",
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress("8.8.8.8"), true);
});
test("URLs, header names and JSON paths cannot smuggle secrets or script", () => {
  for (const url of [
    "http://example.com",
    "https://127.0.0.1",
    "https://a:b@example.com",
    "https://example.com:8443",
    "https://localhost",
    "https://example.com?token=x",
  ])
    assert.throws(() => checkUrl(url));
  for (const name of [
    "Host",
    "Cookie",
    "X-Forwarded-For",
    "Proxy-Authorization",
    "x\r\ninject",
  ])
    assert.throws(() => headerName(name));
  for (const path of ["__proto__.x", "a.constructor", "a[0]", "a()"])
    assert.throws(() => jsonPath(path));
});
test("criteria distinguish code, JSON types, missing fields and malformed responses", () => {
  assert.equal(evaluate(204, "", null, null, null).status, "pass");
  assert.equal(evaluate(401, "", null, null, null).status, "mismatch");
  assert.equal(
    evaluate(200, '{"status":"ok"}', 200, "status", "ok").status,
    "pass",
  );
  assert.equal(
    evaluate(200, '{"value":1}', 200, "value", "1").status,
    "mismatch",
  );
  assert.match(evaluate(200, "{}", 200, "status", "ok").reason, /없습니다/);
  assert.match(evaluate(200, "html", 200, "status", "ok").reason, /JSON/);
  assert.equal(evaluate(302, "", 302, null, null).status, "pass");
});
test("credential ciphertext is random, owner-bound and authenticated", () => {
  process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString(
    "base64",
  );
  const a = seal("test-secret", "owner:check"),
    b = seal("test-secret", "owner:check");
  assert.notEqual(a.nonce, b.nonce);
  assert.equal(unseal(a, "owner:check"), "test-secret");
  assert.throws(() => unseal(a, "other:check"));
  assert.ok(!JSON.stringify(a).includes("test-secret"));
  assert.throws(() => unseal({ ...a, data: "AAAA" }, "owner:check"));
});
test("check configuration validates scalar JSON expectations and credential replacement", () => {
  process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString(
    "base64",
  );
  const item = validateCheck(
    {
      label: "health",
      url: "https://example.com/health",
      auth_type: "bearer",
      secret: "example-only",
      json_path: "status",
      expected_value: '"ok"',
    },
    "owner",
    "check",
  );
  assert.equal(item.expected_value, "ok");
  assert.ok(item.credential);
  assert.throws(() =>
    validateCheck(
      {
        label: "x",
        url: "https://example.com",
        json_path: "x",
        expected_value: "{}",
      },
      "owner",
      "check",
    ),
  );
});
