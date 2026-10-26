import { expireAnalyses } from "./analysis-state";
import { db, one, rows } from "./db";
import { AppError } from "./http";
import type { Repo, Snapshot, Settings, Check } from "./models";
export { db, one, rows };
export async function ownedRepo(owner: string, id: string): Promise<Repo> {
  const row = await one<Repo>(
    "select * from repositories where id=? and owner_id=?",
    [id, owner],
  );
  if (!row) throw new AppError("저장소에 접근할 수 없습니다.", 404);
  return { ...row, private: Boolean(row.private) };
}
export async function settings(owner: string): Promise<Settings> {
  await db().execute({
    sql: "insert into settings(user_id) values(?) on conflict do nothing",
    args: [owner],
  });
  const row = await one<Settings>("select * from settings where user_id=?", [
    owner,
  ]);
  if (!row) throw new AppError("계정 설정을 읽지 못했습니다.", 503);
  return {
    ...row,
    analyze_on_add: Boolean(row.analyze_on_add),
    daily_checks_enabled: Boolean(row.daily_checks_enabled),
  };
}
export async function snapshot(
  owner: string,
  id: string,
): Promise<Snapshot | null> {
  await expireAnalyses(owner);
  const row = await one<
    Snapshot & {
      snapshot: string | null;
      stage: import("../analysis-progress").AnalysisStage | null;
      completed: number;
      total: number | null;
      updated_at: string;
    }
  >(
    `select a.*,p.stage,p.completed,p.total,p.updated_at from analyses a left join analysis_progress p on p.repository_id=a.repository_id and p.owner_id=a.owner_id and (a.latest_status!='running' or p.run_id=a.lease_id) where a.owner_id=? and a.repository_id=?`,
    [owner, id],
  );
  return row
    ? {
        ...row,
        snapshot: row.snapshot ? JSON.parse(row.snapshot) : null,
        progress: row.stage
          ? {
              stage: row.stage,
              completed: row.completed,
              total: row.total,
              updatedAt: row.updated_at,
            }
          : null,
      }
    : null;
}
export function decodeCheck(row: Record<string, unknown>): Check {
  return {
    ...row,
    enabled: Boolean(row.enabled),
    credential: row.credential ? JSON.parse(String(row.credential)) : null,
    expected_value: row.expected_value
      ? JSON.parse(String(row.expected_value))
      : null,
    latest_result: row.latest_result
      ? JSON.parse(String(row.latest_result))
      : null,
  } as Check;
}
export async function ownedCheck(owner: string, id: string) {
  const row = await one<Record<string, unknown>>(
    "select * from checks where owner_id=? and id=?",
    [owner, id],
  );
  if (!row) throw new AppError("점검 대상에 접근할 수 없습니다.", 404);
  return decodeCheck(row);
}
export function checkView(check: Check) {
  const { credential, lease_id, ...view } = check;
  void lease_id;
  return { ...view, hasCredential: Boolean(credential) };
}
