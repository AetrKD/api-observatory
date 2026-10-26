import { randomUUID } from "node:crypto";
import { analyzeRepository, AnalysisError } from "../github";
import { repositoryAccess } from "../github/access";
import { db, ownedRepo } from "./store";
import { AppError } from "./http";
import { claimAnalysis, saveProgress } from "./analysis-state";
import { progressAt } from "../analysis-progress";
export async function prepareAnalysis(owner: string, id: string) {
  const repo = await ownedRepo(owner, id),
    lease = randomUUID();
  await claimAnalysis(owner, id, lease);
  return async () => {
    try {
      const access = await repositoryAccess(owner, repo);
      const result = await analyzeRepository(repo.url, fetch, access, (p) =>
        saveProgress(owner, id, lease, p),
      );
      await saveProgress(
        owner,
        id,
        lease,
        progressAt("saving", result.filesScanned, result.filesScanned),
      );
      const saved = await db().execute({
        sql: "update analyses set snapshot=?,last_success_at=?,latest_status='success',latest_at=?,reason=null,lease_id=null,lease_until=null where repository_id=? and owner_id=? and lease_id=? and latest_status='running' and lease_until>?",
        args: [
          JSON.stringify(result),
          result.analyzedAt,
          result.analyzedAt,
          id,
          owner,
          lease,
          Date.now(),
        ],
      });
      if (!saved.rowsAffected)
        throw new AppError(
          "분석 실행 시간이 만료되었습니다. 다시 시도해 주세요.",
          409,
        );
      return result;
    } catch (e) {
      const reason =
        e instanceof AnalysisError || e instanceof AppError
          ? e.message
          : "분석 중 오류가 발생했습니다.";
      await db().execute({
        sql: "update analyses set latest_status='failed',latest_at=?,reason=?,lease_id=null,lease_until=null where repository_id=? and owner_id=? and lease_id=?",
        args: [new Date().toISOString(), reason, id, owner, lease],
      });
      throw new AppError(
        reason,
        e instanceof AnalysisError || e instanceof AppError ? e.status : 502,
      );
    }
  };
}
export async function runAnalysis(owner: string, id: string) {
  return (await prepareAnalysis(owner, id))();
}
