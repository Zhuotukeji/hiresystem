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

export function stageToKitStage(stage: string) {
  if (stage === "FIRST_INTERVIEW") return "first_interview";
  if (stage === "SECOND_INTERVIEW") return "second_interview";
  if (stage === "FINAL_INTERVIEW") return "final_interview";
  return "hr_screen";
}
