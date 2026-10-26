import type { Analysis } from "../types";
import type { Sealed } from "../checks/crypto";
export type Repo = {
  id: string;
  owner_id: string;
  github_id: number;
  url: string;
  name: string;
  private: boolean;
  created_at: string;
};
export type Check = {
  id: string;
  owner_id: string;
  repository_id: string;
  label: string;
  url: string;
  auth_type: "none" | "bearer" | "header";
  header_name: string | null;
  credential: Sealed | null;
  response_format: import("../checks/accept").ResponseFormat;
  expected_code: number | null;
  json_path: string | null;
  expected_value: unknown;
  enabled: boolean;
  latest_result: CheckResult | null;
  lease_id: string | null;
};
export type CheckResult = {
  status: "pass" | "mismatch" | "error";
  reason: string;
  checkedAt: string;
  httpCode: number | null;
  durationMs: number;
  trigger: "manual" | "scheduled";
};
export type Snapshot = {
  repository_id: string;
  snapshot: Analysis | null;
  last_success_at: string | null;
  latest_status: string;
  latest_at: string;
  reason: string | null;
  lease_id: string | null;
  lease_until: number | null;
  progress?: import("../analysis-progress").AnalysisProgress | null;
};
export type Settings = {
  user_id: string;
  analyze_on_add: boolean;
  daily_checks_enabled: boolean;
};
