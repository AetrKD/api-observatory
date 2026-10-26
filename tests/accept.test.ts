import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptHeader, responseFormat } from "../src/lib/checks/accept";
import { validateCheck } from "../src/lib/checks/validation";
test("Accept preferences have explicit safe values and preserve default behavior", () => {
  assert.equal(acceptHeader(undefined), "*/*");
  assert.equal(acceptHeader("json"), "application/json");
  assert.equal(acceptHeader("text"), "text/plain");
  assert.equal(acceptHeader("html"), "text/html");
  for (const bad of [
    "",
    "application/json\r\nAuthorization: bad",
    "__proto__",
    {},
    true,
  ])
    assert.throws(() => responseFormat(bad));
  const input = {
    label: "GET demo",
    url: "https://example.com",
    auth_type: "none",
  };
  assert.equal(
    validateCheck({ ...input, response_format: "json" }, "owner", "id")
      .response_format,
    "json",
  );
  assert.throws(() =>
    validateCheck({ ...input, response_format: "evil" }, "owner", "id"),
  );
});

test("editing old checks without an Accept field preserves an existing JSON preference", () => {
  const input = {
    label: "GET demo",
    url: "https://example.com",
    auth_type: "none",
    response_format: "json",
  };
  const existing = validateCheck(input, "owner", "id");
  const changed = validateCheck(
    { label: "Renamed", url: "https://example.com", auth_type: "none" },
    "owner",
    "id",
    existing as import("../src/lib/server/models").Check,
  );
  assert.equal(changed.response_format, "json");
});
