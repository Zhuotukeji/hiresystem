export function hasResumeInput(fileCount: number, resumeText?: string) {
  return fileCount > 0 || Boolean(resumeText?.trim());
}

export function canSubmitAiCandidate(jobId?: string, name?: string) {
  return Boolean(jobId?.trim() && name?.trim());
}

export function getCandidateAiSubmitBlocker(params: { jobId?: string; name?: string; resumeParsed: boolean }) {
  if (!params.jobId?.trim()) return "请选择目标岗位";
  if (!params.resumeParsed) return "请先识别简历并确认候选人信息";
  if (!params.name?.trim()) return "请补充候选人姓名";
  return "";
}

export function canStartManualCandidateEvaluation(jobId?: string, isEvaluating = false) {
  return Boolean(jobId?.trim()) && !isEvaluating;
}
