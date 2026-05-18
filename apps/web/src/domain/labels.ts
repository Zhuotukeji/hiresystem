type LabelValue = string | null | undefined;

function labelFromMap(value: LabelValue, labels: Record<string, string>) {
  if (!value) return "-";
  return labels[value] ?? value;
}

export const candidateStatusLabels: Record<string, string> = {
  NEW: "新候选人",
  TO_CONTACT: "待触达",
  CONTACTED: "已触达",
  REPLIED: "已回复",
  INTERESTED: "有意向",
  NOT_NOW: "暂不考虑",
  IN_PROCESS: "流程中",
  OFFERED: "已发 Offer",
  HIRED: "已入职",
  REJECTED: "已淘汰",
  DO_NOT_CONTACT: "不再触达"
};

export const jobStatusLabels: Record<string, string> = {
  OPEN: "招聘中",
  PAUSED: "已暂停",
  CLOSED: "已关闭"
};

export const recommendationActionLabels: Record<string, string> = {
  advance_to_hr_screen: "建议进入 HR 初筛",
  send_to_hiring_manager_review: "建议用人经理快审",
  reject_for_current_job: "当前岗位不匹配",
  add_to_talent_pool: "加入人才池",
  need_more_information: "需补充信息"
};

export const evaluationResponseStatusLabels: Record<string, string> = {
  queued: "已进入 AI 判断队列",
  completed: "已完成",
  failed: "失败",
  local_completed: "本地识别完成"
};

export const interviewKitStatusLabels: Record<string, string> = {
  queued: "面试套件生成中",
  not_required: "暂不需要生成面试套件",
  completed: "面试套件已生成",
  failed: "面试套件生成失败"
};

export const interviewStageLabels: Record<string, string> = {
  hr_screen: "HR 初筛",
  first_interview: "一面",
  second_interview: "二面",
  final_interview: "终面"
};

export const interviewStatusLabels: Record<string, string> = {
  SCHEDULED: "待面试",
  COMPLETED: "已完成",
  CANCELED: "已取消"
};

export const aiEvaluationNextActionLabels: Record<string, string> = {
  AI_EVALUATION_RUNNING: "AI判断中",
  AI_EVALUATION_COMPLETED: "AI判断完成",
  AI_EVALUATION_FAILED: "AI判断失败"
};

export const companyTypeLabels: Record<string, string> = {
  competitor: "竞品公司",
  benchmark: "标杆公司",
  similar_stage: "同阶段公司"
};

export function candidateStatusLabel(status: LabelValue) {
  return labelFromMap(status, candidateStatusLabels);
}

export function jobStatusLabel(status: LabelValue) {
  return labelFromMap(status, jobStatusLabels);
}

export function recommendationActionLabel(action: LabelValue) {
  return labelFromMap(action, recommendationActionLabels);
}

export function evaluationResponseStatusLabel(status: LabelValue) {
  return labelFromMap(status, evaluationResponseStatusLabels);
}

export function interviewKitStatusLabel(status: LabelValue) {
  return labelFromMap(status, interviewKitStatusLabels);
}

export function interviewStageLabel(stage: LabelValue) {
  return labelFromMap(stage, interviewStageLabels);
}

export function interviewStatusLabel(status: LabelValue) {
  return labelFromMap(status, interviewStatusLabels);
}

export function aiEvaluationNextActionLabel(action: LabelValue) {
  return labelFromMap(action, aiEvaluationNextActionLabels);
}

export function companyTypeLabel(type: LabelValue) {
  return labelFromMap(type, companyTypeLabels);
}
