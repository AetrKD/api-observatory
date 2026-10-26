export const analysisStages = [
  "access",
  "listing",
  "reading",
  "analyzing",
  "saving",
] as const;
export type AnalysisStage = (typeof analysisStages)[number];
export type AnalysisProgress = {
  stage: AnalysisStage;
  completed: number;
  total: number | null;
  updatedAt: string;
};
export type ProgressReporter = (progress: AnalysisProgress) => Promise<void>;
export const stageLabels: Record<AnalysisStage, string> = {
  access: "저장소 접근 권한 확인",
  listing: "분석할 파일 목록 수집",
  reading: "소스 파일 읽기",
  analyzing: "API 호출 분석",
  saving: "결과 저장",
};
export function progressAt(
  stage: AnalysisStage,
  completed = 0,
  total: number | null = null,
): AnalysisProgress {
  return { stage, completed, total, updatedAt: new Date().toISOString() };
}
