import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, one } from "../src/lib/server/store";
import {
  saveProjectProfile,
  getProjectProfile,
  runProjectProbe,
} from "../src/lib/checks/project-service";
import type { Analysis, Finding } from "../src/lib/types";
const enabled = process.env.RUN_TURSO_TESTS === "1";
const finding = (
  id: string,
  address: string,
  extra: Partial<Finding> = {},
): Finding => ({
  id,
  address,
  service: "HTTP",
  method: "GET",
  resolution: address.startsWith("/") ? "internal" : "resolved",
  file: "app.ts",
  line: 1,
  column: 1,
  functionName: "load",
  operation: "fetch",
  expression: "",
  evidence: "",
  ...extra,
});
test(
  "project settings and automatic checks isolate owners, scope credentials, cache results and never persist bodies",
  { skip: !enabled },
  async () => {
    const owner = "project-probe-" + randomUUID(),
      id = randomUUID(),
      now = Date.now();
    let calls = 0;
    try {
      await db().execute({
        sql: "insert into user(id,name,email,emailVerified,createdAt,updatedAt) values(?,?,?,?,?,?)",
        args: [
          owner,
          "project probe fixture",
          owner + "@example.invalid",
          0,
          now,
          now,
        ],
      });
      await db().execute({
        sql: "insert into repositories(id,owner_id,github_id,url,name,private) values(?,?,?,?,?,0)",
        args: [
          id,
          owner,
          987,
          "https://github.com/test/project-probe",
          "test/project-probe",
        ],
      });
      const analysis: Analysis = {
        repository: "https://github.com/test/project-probe",
        commit: "same-commit",
        analyzedAt: new Date(now).toISOString(),
        filesScanned: 1,
        skippedFiles: 0,
        parseErrors: [],
        warnings: [],
        findings: [
          finding("a", "/status"),
          finding("b", "/status"),
          finding("post", "/start", { method: "POST" }),
          finding("foreign", "https://foreign.example.com/api"),
        ],
      };
      await db().execute({
        sql: "insert into analyses(repository_id,owner_id,snapshot,latest_status) values(?,?,?,?)",
        args: [id, owner, JSON.stringify(analysis), "success"],
      });
      const profile = await saveProjectProfile(owner, id, {
        deploymentUrl: "https://service.example.com",
        authType: "bearer",
        responseFormat: "json",
        secret: "fixture-shared-secret",
        autoEnabled: true,
      });
      assert.equal(profile.hasCredential, true);
      assert.equal(profile.responseFormat, "json");
      assert.equal(
        (await getProjectProfile(owner, id))?.responseFormat,
        "json",
      );
      assert.ok(!JSON.stringify(profile).includes("fixture-shared-secret"));
      const raw = await one<{ credential: string }>(
        "select credential from project_probes where repository_id=?",
        [id],
      );
      assert.ok(!raw!.credential.includes("fixture-shared-secret"));
      const transport = async (
        url: string,
        headers: Record<string, string>,
      ) => {
        calls++;
        assert.equal(headers.Accept, "application/json");
        assert.equal(url, "https://service.example.com/status");
        assert.equal(headers.Authorization, "Bearer fixture-shared-secret");
        return {
          code: 200,
          text: '{"status":"ok","access_token":"response-secret","echo":"fixture-shared-secret"}',
          duration: 12,
          contentType: "application/json",
        };
      };
      const result = await runProjectProbe(owner, id, true, transport);
      assert.equal(calls, 1);
      assert.equal(result.run?.checkedCount, 2);
      assert.equal(result.run?.skippedCount, 2);
      assert.ok(result.run?.results[0].preview);
      assert.equal(result.run?.results[1].preview, undefined);
      assert.ok(!JSON.stringify(result).includes("response-secret"));
      assert.ok(!JSON.stringify(result).includes("fixture-shared-secret"));
      const saved = await getProjectProfile(owner, id);
      assert.ok(saved?.latest);
      assert.ok(!JSON.stringify(saved).includes("preview"));
      assert.ok(!JSON.stringify(saved).includes("response-secret"));
      const cached = await runProjectProbe(owner, id, false, transport);
      assert.ok(cached.run);
      assert.equal(calls, 1);
      const deferred = await runProjectProbe(owner, id, true, transport);
      assert.ok(deferred.retryAfterMs);
      assert.equal(calls, 1);
      await assert.rejects(getProjectProfile("another-owner", id));
      await assert.rejects(saveProjectProfile("another-owner", id, {}));
      await assert.rejects(
        runProjectProbe("another-owner", id, true, transport),
      );
      await assert.rejects(
        saveProjectProfile(owner, id, {
          deploymentUrl: "https://other.example.com",
          authType: "bearer",
        }),
        /새로 입력/,
      );
      await assert.rejects(
        saveProjectProfile(owner, id, {
          deploymentUrl: "https://service.example.com/path",
          authType: "none",
        }),
        /경로/,
      );
      await saveProjectProfile(owner, id, {
        deploymentUrl: "https://service.example.com",
        authType: "bearer",
        autoEnabled: false,
      });
      const disabled = await runProjectProbe(owner, id, false, transport);
      assert.equal(disabled.disabled, true);
      assert.equal(calls, 1);
      await db().execute({
        sql: "update project_probes set last_run_at=? where repository_id=?",
        args: [now - 31000, id],
      });
      assert.ok((await runProjectProbe(owner, id, true, transport)).run);
      assert.equal(calls, 2);
      await saveProjectProfile(owner, id, {
        deploymentUrl: "https://service.example.com",
        authType: "bearer",
        autoEnabled: true,
      });
      await db().execute({
        sql: "update project_probes set last_run_at=? where repository_id=?",
        args: [now - 31000, id],
      });
      await runProjectProbe(owner, id, false, transport);
      assert.equal(calls, 3);
      analysis.analyzedAt = new Date(now + 1000).toISOString();
      await db().execute({
        sql: "update analyses set snapshot=? where repository_id=?",
        args: [JSON.stringify(analysis), id],
      });
      await db().execute({
        sql: "update project_probes set last_run_at=? where repository_id=?",
        args: [now - 31000, id],
      });
      await runProjectProbe(owner, id, false, transport);
      assert.equal(calls, 4);
      const cleared = await saveProjectProfile(owner, id, {
        deploymentUrl: "",
        authType: "bearer",
      });
      assert.equal(cleared.deploymentUrl, "");
      assert.equal(cleared.hasCredential, false);
      assert.equal(cleared.latest, null);
    } finally {
      await db().execute({ sql: "delete from user where id=?", args: [owner] });
    }
  },
);
test(
  "concurrent project checks claim once and settings cannot change during an active run",
  { skip: !enabled },
  async () => {
    const owner = "project-lease-" + randomUUID(),
      id = randomUUID(),
      now = Date.now();
    let release!: () => void, started!: () => void;
    const gate = new Promise<void>((r) => (release = r)),
      entered = new Promise<void>((r) => (started = r));
    try {
      await db().execute({
        sql: "insert into user(id,name,email,emailVerified,createdAt,updatedAt) values(?,?,?,?,?,?)",
        args: [
          owner,
          "project lease fixture",
          owner + "@example.invalid",
          0,
          now,
          now,
        ],
      });
      await db().execute({
        sql: "insert into repositories(id,owner_id,github_id,url,name,private) values(?,?,?,?,?,0)",
        args: [id, owner, 988, "https://github.com/test/lease", "test/lease"],
      });
      await db().execute({
        sql: "insert into analyses(repository_id,owner_id,snapshot,latest_status) values(?,?,?,?)",
        args: [
          id,
          owner,
          JSON.stringify({
            commit: "c",
            analyzedAt: new Date(now).toISOString(),
            findings: [finding("get", "/health")],
          }),
          "success",
        ],
      });
      await saveProjectProfile(owner, id, {
        deploymentUrl: "https://service.example.com",
      });
      const sibling = randomUUID();
      await db().execute({
        sql: "insert into repositories(id,owner_id,github_id,url,name,private) values(?,?,?,?,?,0)",
        args: [
          sibling,
          owner,
          989,
          "https://github.com/test/sibling",
          "test/sibling",
        ],
      });
      await db().execute({
        sql: "insert into analyses(repository_id,owner_id,snapshot,latest_status) values(?,?,?,?)",
        args: [
          sibling,
          owner,
          JSON.stringify({
            commit: "c",
            analyzedAt: new Date(now).toISOString(),
            findings: [finding("get", "/health")],
          }),
          "success",
        ],
      });
      await saveProjectProfile(owner, sibling, {
        deploymentUrl: "https://service.example.com",
      });
      const noRequest = async () => {
        throw new Error("Unexpected additional request");
      };
      const running = runProjectProbe(owner, id, true, async () => {
        started();
        await gate;
        return { code: 200, text: "ok", duration: 10 };
      });
      await entered;
      const second = await runProjectProbe(owner, id, true);
      assert.equal(second.running, true);
      assert.ok(
        (await runProjectProbe(owner, sibling, true, noRequest)).retryAfterMs,
      );
      await assert.rejects(
        saveProjectProfile(owner, id, {
          deploymentUrl: "https://other.example.com",
        }),
        /조회 중/,
      );
      release();
      assert.ok((await running).run);
      assert.ok(
        (await runProjectProbe(owner, sibling, true, noRequest)).retryAfterMs,
      );
    } finally {
      release?.();
      await db().execute({ sql: "delete from user where id=?", args: [owner] });
    }
  },
);

after(() => {
  if (enabled) db().close();
});
