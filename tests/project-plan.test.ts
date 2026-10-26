import { test } from "node:test";
import assert from "node:assert/strict";
import { planProjectRequests } from "../src/lib/checks/project-plan";
import type { Finding } from "../src/lib/types";
const finding = (
  id: string,
  address: string | null,
  extra: Partial<Finding> = {},
): Finding => ({
  id,
  address,
  service: "HTTP",
  method: "GET",
  resolution: address?.startsWith("/")
    ? "internal"
    : address
      ? "resolved"
      : "unresolved",
  file: "app.js",
  line: 1,
  column: 1,
  functionName: "load",
  operation: "fetch",
  expression: "",
  evidence: "",
  ...extra,
});
test("project plan maps relative GET routes and deduplicates network requests", () => {
  const p = planProjectRequests(
    [
      finding("a", "/api/status"),
      finding("b", "/api/status"),
      finding("c", "https://app.example.com/health"),
    ],
    "https://app.example.com",
  );
  assert.equal(p.targets.size, 2);
  assert.deepEqual(p.targets.get("https://app.example.com/api/status"), [
    "a",
    "b",
  ]);
});
test("project credentials can only reach same-origin public HTTPS GET candidates", () => {
  const p = planProjectRequests(
    [
      finding("post", "/start", { method: "POST" }),
      finding("ws", "/ws", { method: "WS", service: "WebSocket" }),
      finding("foreign", "https://other.example.com/api"),
      finding("dynamic", null),
      finding("secret", "/api?token=secret"),
      finding("relative", "api/status"),
      finding("good", "/health"),
    ],
    "https://app.example.com",
  );
  assert.deepEqual([...p.targets.keys()], ["https://app.example.com/health"]);
  assert.ok(
    p.results
      .filter((r) => r.findingId !== "good")
      .every((r) => r.status === "skipped" && r.reason),
  );
});
test("project request cap counts unique URLs and does not lose duplicate source locations", () => {
  const p = planProjectRequests(
    [
      ...Array.from({ length: 22 }, (_, i) => finding(String(i), "/api/" + i)),
      finding("duplicate", "/api/0"),
    ],
    "https://app.example.com",
  );
  assert.equal(p.targets.size, 20);
  assert.equal(p.targets.get("https://app.example.com/api/0")!.length, 2);
  assert.match(p.results.find((r) => r.findingId === "21")!.reason, /20개/);
});

test("oversized automatic URLs are excluded before any request", () => {
  const p = planProjectRequests(
    [finding("large", "/" + "x".repeat(3000))],
    "https://app.example.com",
  );
  assert.equal(p.targets.size, 0);
  assert.equal(p.results[0].url, null);
  assert.match(p.results[0].reason, /2048/);
});
