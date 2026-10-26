import { db } from "./db";
import { progressAt, type AnalysisProgress } from "../analysis-progress";
import { AppError } from "./http";
export const leaseDuration = 180_000;
export async function claimAnalysis(owner: string, id: string, lease: string) {
  const now = Date.now();
  await db().execute({
    sql: "insert into analyses(repository_id,owner_id) values(?,?) on conflict do nothing",
    args: [id, owner],
  });
  const claimed = await db().execute({
    sql: "update analyses set lease_id=?,lease_until=?,latest_status='running',latest_at=?,reason=null where repository_id=? and owner_id=? and (lease_until is null or lease_until<?) returning repository_id",
    args: [
      lease,
      now + leaseDuration,
      new Date(now).toISOString(),
      id,
      owner,
      now,
    ],
  });
  if (!claimed.rows.length)
    throw new AppError("이미 분석 중입니다. 잠시 후 확인해 주세요.", 409);
  await saveProgress(owner, id, lease, progressAt("access"));
}
export async function saveProgress(
  owner: string,
  id: string,
  lease: string,
  p: AnalysisProgress,
) {
  const result = await db().execute({
    sql: "insert into analysis_progress(repository_id,owner_id,run_id,stage,completed,total,updated_at) select ?,?,?,?,?,?,? where exists(select 1 from analyses where repository_id=? and owner_id=? and lease_id=? and latest_status='running' and lease_until>?) on conflict(repository_id) do update set run_id=excluded.run_id,stage=excluded.stage,completed=excluded.completed,total=excluded.total,updated_at=excluded.updated_at",
    args: [
      id,
      owner,
      lease,
      p.stage,
      p.completed,
      p.total,
      p.updatedAt,
      id,
      owner,
      lease,
      Date.now(),
    ],
  });
  if (!result.rowsAffected)
    throw new AppError(
      "분석 실행 시간이 만료되었습니다. 다시 시도해 주세요.",
      409,
    );
}
export async function expireAnalyses(owner: string) {
  await db().execute({
    sql: "update analyses set latest_status='failed',reason=?,latest_at=?,lease_id=null,lease_until=null where owner_id=? and latest_status='running' and (lease_until is null or lease_until<=?)",
    args: [
      "분석이 제한 시간 안에 완료되지 않았습니다. 다시 시도해 주세요.",
      new Date().toISOString(),
      owner,
      Date.now(),
    ],
  });
}
