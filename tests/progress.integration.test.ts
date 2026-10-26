import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, snapshot } from "../src/lib/server/store";
import {
  claimAnalysis,
  saveProgress,
  expireAnalyses,
} from "../src/lib/server/analysis-state";
import { progressAt } from "../src/lib/analysis-progress";
test(
  "Turso progress survives reads, isolates owners, rejects stale writers, preserves results on expiry",
  { skip: process.env.RUN_TURSO_TESTS !== "1" },
  async () => {
    const owner = "progress-" + randomUUID(),
      id = randomUUID(),
      lease = randomUUID(),
      now = Date.now();
    try {
      await db().execute({
        sql: "insert into user(id,name,email,emailVerified,createdAt,updatedAt) values(?,?,?,?,?,?)",
        args: [
          owner,
          "progress fixture",
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
          101,
          "https://github.com/test/progress",
          "progress fixture",
        ],
      });
      await claimAnalysis(owner, id, lease);
      await assert.rejects(claimAnalysis(owner, id, randomUUID()));
      await saveProgress(owner, id, lease, progressAt("reading", 4, 8));
      const state = await snapshot(owner, id);
      assert.equal(state?.progress?.stage, "reading");
      assert.equal(state?.progress?.completed, 4);
      assert.equal(await snapshot("another-user", id), null);
      await assert.rejects(
        saveProgress("another-user", id, lease, progressAt("saving")),
      );
      await assert.rejects(
        saveProgress(owner, id, "stale-lease", progressAt("saving")),
      );
      await db().execute({
        sql: "update analyses set snapshot=?,lease_until=? where repository_id=?",
        args: [JSON.stringify({ fixture: true }), now - 1, id],
      });
      await expireAnalyses(owner);
      const expired = await snapshot(owner, id);
      assert.equal(expired?.latest_status, "failed");
      assert.equal(expired?.progress?.stage, "reading");
      assert.deepEqual(expired?.snapshot, { fixture: true });
      await claimAnalysis(owner, id, "second");
      await assert.rejects(
        saveProgress(owner, id, lease, progressAt("saving")),
      );
      assert.equal((await snapshot(owner, id))?.progress?.stage, "access");
    } finally {
      await db().execute({ sql: "delete from user where id=?", args: [owner] });
      db().close();
    }
  },
);
