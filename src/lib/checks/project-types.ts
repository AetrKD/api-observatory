import type { ResponsePreview } from "./preview";
export type ProjectApiResult = {
  findingId: string;
  url: string | null;
  status: "pass" | "mismatch" | "error" | "skipped";
  reason: string;
  httpCode: number | null;
  durationMs: number | null;
  checkedAt: string | null;
  preview?: ResponsePreview;
};
export type ProjectRun = {
  repositoryId: string;
  commit: string;
  analysisAt: string;
  revision: string;
  checkedAt: string;
  checkedCount: number;
  skippedCount: number;
  results: ProjectApiResult[];
};
export type ProjectProfile = {
  deploymentUrl: string;
  responseFormat: import("./accept").ResponseFormat;
  authType: "none" | "bearer" | "header";
  headerName: string;
  hasCredential: boolean;
  autoEnabled: boolean;
  revision: string;
  running: boolean;
  lastError: string | null;
  latest: ProjectRun | null;
};
export type ProjectExecution = {
  disabled?: boolean;
  run?: ProjectRun;
  retryAfterMs?: number;
  running?: boolean;
};
export type ProjectTestingState = {
  repositoryId: string;
  configured: boolean;
  phase: "idle" | "running" | "waiting";
  run: ProjectRun | null;
};
