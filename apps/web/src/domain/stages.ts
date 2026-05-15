export const pipelineStages = [
  "NEW",
  "HR_SCREEN",
  "MANAGER_REVIEW",
  "FIRST_INTERVIEW",
  "SECOND_INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "TALENT_POOL"
];

export const stageLabels: Record<string, string> = {
  NEW: "新候选人",
  HR_SCREEN: "HR 初筛",
  MANAGER_REVIEW: "用人经理快审",
  FIRST_INTERVIEW: "一面",
  SECOND_INTERVIEW: "二面",
  FINAL_INTERVIEW: "终面",
  OFFER: "Offer",
  HIRED: "已入职",
  REJECTED: "已淘汰",
  TALENT_POOL: "人才池"
};

export function stageLabel(stage: string) {
  return stageLabels[stage] ?? stage;
}

export function stageToKitStage(stage: string) {
  if (stage === "FIRST_INTERVIEW") return "first_interview";
  if (stage === "SECOND_INTERVIEW") return "second_interview";
  if (stage === "FINAL_INTERVIEW") return "final_interview";
  return "hr_screen";
}
