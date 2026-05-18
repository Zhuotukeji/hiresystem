import { describe, expect, it } from "vitest";
import {
  aiEvaluationNextActionLabel,
  candidateStatusLabel,
  companyTypeLabel,
  evaluationResponseStatusLabel,
  interviewKitStatusLabel,
  interviewStageLabel,
  jobStatusLabel,
  recommendationActionLabel
} from "./labels";

describe("display labels", () => {
  it("renders Chinese labels for candidate and job statuses", () => {
    expect(candidateStatusLabel("TO_CONTACT")).toBe("待触达");
    expect(candidateStatusLabel("IN_PROCESS")).toBe("流程中");
    expect(jobStatusLabel("OPEN")).toBe("招聘中");
    expect(jobStatusLabel("PAUSED")).toBe("已暂停");
  });

  it("renders Chinese labels for AI resume evaluation values", () => {
    expect(recommendationActionLabel("advance_to_hr_screen")).toBe("建议进入 HR 初筛");
    expect(recommendationActionLabel("send_to_hiring_manager_review")).toBe("建议用人经理快审");
    expect(evaluationResponseStatusLabel("queued")).toBe("已进入 AI 判断队列");
    expect(aiEvaluationNextActionLabel("AI_EVALUATION_RUNNING")).toBe("AI判断中");
  });

  it("renders Chinese labels for interview and sourcing values", () => {
    expect(interviewStageLabel("first_interview")).toBe("一面");
    expect(interviewKitStatusLabel("not_required")).toBe("暂不需要生成面试套件");
    expect(companyTypeLabel("competitor")).toBe("竞品公司");
  });

  it("keeps unknown values visible for debugging", () => {
    expect(candidateStatusLabel("CUSTOM_STATUS")).toBe("CUSTOM_STATUS");
    expect(recommendationActionLabel(undefined)).toBe("-");
  });
});
