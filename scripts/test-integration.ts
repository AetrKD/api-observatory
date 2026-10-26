process.env.RUN_TURSO_TESTS = "1";
import("../tests/turso.integration.test").catch(() => {
  console.error("Turso 통합 테스트 실행 실패");
  process.exitCode = 1;
});
