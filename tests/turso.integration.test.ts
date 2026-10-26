import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  db,
  rows,
  ownedRepo,
  ownedCheck,
  settings,
  snapshot,
} from "../src/lib/server/store";
import { runCheck } from "../src/lib/checks/service";
const enabled = process.env.RUN_TURSO_TESTS === "1";
test(
  "real Turso ownership, constraints, preserved snapshots and atomic check claims",
  { skip: !enabled },
  async () => {
    const owner = "test-" + randomUUID(),
      other = "test-" + randomUUID(),
      repo = randomUUID(),
      check = randomUUID(),
      now = Date.now();
    try {
      for (const id of [owner, other])
        await db().execute({
          sql: "insert into user(id,name,email,emailVerified,createdAt,updatedAt) values(?,?,?,?,?,?)",
          args: [
            id,
            "integration fixture",
            id + "@example.invalid",
            0,
            now,
            now,
          ],
        });
      const prefs = await settings(owner);
      assert.equal(prefs.analyze_on_add, true);
      assert.equal(prefs.daily_checks_enabled, true);
      await db().execute({
        sql: "insert into repositories(id,owner_id,github_id,url,name,private) values(?,?,?,?,?,0)",
        args: [repo, owner, 99, "https://github.com/test/fixture", "fixture"],
      });
      assert.equal((await ownedRepo(owner, repo)).id, repo);
      await assert.rejects(() => ownedRepo(other, repo));
      await db().execute({
        sql: "insert into analyses(repository_id,owner_id,snapshot,latest_status) values(?,?,?,'success')",
        args: [repo, owner, JSON.stringify({ fixture: true })],
      });
      await db().execute({
        sql: "update analyses set latest_status='failed',reason='fixture failure' where repository_id=? and owner_id=?",
        args: [repo, owner],
      });
      const saved = await snapshot(owner, repo);
      assert.equal(
        (saved?.snapshot as unknown as { fixture: boolean }).fixture,
        true,
      );
      assert.equal(saved?.latest_status, "failed");
      await db().execute({
        sql: "insert into checks(id,owner_id,repository_id,label,url,auth_type) values(?,?,?,?,?,'none')",
        args: [check, owner, repo, "fixture", "https://example.com/health"],
      });
      await assert.rejects(() => ownedCheck(other, check));
      await assert.rejects(() =>
        db().execute({
          sql: "insert into checks(id,owner_id,repository_id,label,url,auth_type) values(?,?,?,?,?,'none')",
          args: [
            randomUUID(),
            other,
            repo,
            "invalid owner",
            "https://example.com",
          ],
        }),
      );
      await db().execute({
        sql: "update settings set daily_checks_enabled=0 where user_id=?",
        args: [owner],
      });
      await db().execute({
        sql: "update checks set response_format=? where id=?",
        args: ["json", check],
      });
      assert.equal((await ownedCheck(owner, check)).response_format, "json");
      const transport = async (
        _url: string,
        headers: Record<string, string>,
      ) => {
        assert.equal(headers.Accept, "application/json");
        await new Promise((r) => setTimeout(r, 100));
        return { code: 200, text: '{"status":"ok"}', duration: 100 };
      };
      const outcomes = await Promise.allSettled([
        runCheck(owner, check, "manual", transport),
        runCheck(owner, check, "manual", transport),
      ]);
      assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
      const manual = outcomes.find((x) => x.status === "fulfilled");
      assert.ok(
        manual?.status === "fulfilled" &&
          manual.value &&
          "preview" in manual.value,
      );
      const persisted = (await ownedCheck(owner, check)).latest_result;
      assert.ok(persisted && !("preview" in persisted));
      assert.equal(
        (await ownedCheck(owner, check)).latest_result?.trigger,
        "manual",
      );
      assert.equal(await runCheck(owner, check, "scheduled", transport), null);
      await db().execute({
        sql: "update settings set daily_checks_enabled=1 where user_id=?",
        args: [owner],
      });
      const scheduled = await runCheck(owner, check, "scheduled", transport);
      assert.ok(scheduled && !("preview" in scheduled));
      assert.equal(await runCheck(owner, check, "scheduled", transport), null);
      assert.equal(
        (await ownedCheck(owner, check)).latest_result?.trigger,
        "scheduled",
      );
      assert.equal((await snapshot(owner, repo))?.latest_status, "failed");
    } finally {
      await db().execute({
        sql: "delete from user where id in (?,?)",
        args: [owner, other],
      });
      const remaining = await rows(
        "select id from repositories where owner_id=?",
        [owner],
      );
      assert.equal(remaining.length, 0);
      db().close();
    }
  },
);
