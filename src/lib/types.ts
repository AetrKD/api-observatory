export type SourceFile = {
  path: string;
  content: string;
  templateRanges?: { start: number; end: number }[];
};
export type Finding = {
  id: string;
  service: string;
  method: string;
  operation: string;
  file: string;
  line: number;
  column: number;
  functionName: string;
  address: string | null;
  expression: string;
  resolution: "resolved" | "unresolved" | "internal";
  evidence: string;
  codeUrl?: string;
};
export type Analysis = {
  repository: string;
  commit: string;
  analyzedAt: string;
  filesScanned: number;
  skippedFiles: number;
  parseErrors: string[];
  findings: Finding[];
  warnings: string[];
};
