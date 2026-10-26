export const ANALYSIS_LIMITS = {
  maxFiles: 200,
  maxFileBytes: 400 * 1024,
  maxTotalBytes: 10 * 1024 * 1024,
  timeoutMs: 120_000,
  readConcurrency: 4,
} as const;
export const analysisLimitMessage =
  "지원 한도 초과: 소스 200개, 파일당 400 KiB, 전체 10 MiB 이하 저장소를 사용해 주세요.";
export function supportedSource(path: string) {
  return (
    /\.(?:[cm]?[jt]s|[jt]sx|py|vue|html?)$/.test(path) &&
    !/(^|\/)(?:node_modules|dist|build|coverage|vendor|\.git|\.next|\.nuxt|\.output|\.venv|venv|__pycache__)(\/|$)/.test(
      path,
    ) &&
    !/(^|\/)\.env/.test(path) &&
    !/\.d\.[cm]?ts$/.test(path)
  );
}
