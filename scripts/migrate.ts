import { readFile } from "node:fs/promises";
import { db } from "../src/lib/server/db";
async function main() {
  const sql = await readFile("db/schema.sql", "utf8");
  await db().executeMultiple(sql);
  for (const table of ["checks", "project_probes"]) {
    const columns = await db().execute("pragma table_info(" + table + ")");
    if (!columns.rows.some((column) => column.name === "response_format"))
      await db().execute(
        "alter table " +
          table +
          " add column response_format TEXT NOT NULL DEFAULT 'default' CHECK(response_format IN ('default','json','text','html'))",
      );
  }
  console.log("Turso 스키마 적용 완료");
  db().close();
}
main().catch(() => {
  console.error("Turso 스키마 적용 실패: 연결 설정을 확인해 주세요.");
  process.exitCode = 1;
});
