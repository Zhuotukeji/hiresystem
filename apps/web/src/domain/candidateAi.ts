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

export function isResumeParseRouteMissingError(message: string) {
  return /Cannot POST .*resume-parse/i.test(message) || /resume-parse.*Not Found/i.test(message);
}

export function shouldFallbackToResumeParseText(message: string) {
  return isResumeParseRouteMissingError(message) || /multipart|unsupported media|payload too large|request entity|413/i.test(message);
}

export function getResumeParseErrorMessage(message: string) {
  if (isResumeParseRouteMissingError(message)) {
    return "简历识别接口不可用：线上 API 版本可能过旧，或 nginx 没有转发到最新 Nest 服务。请重建 API 容器后检查 /api/health 是否包含 resumeParse。";
  }
  return message || "简历识别失败";
}
