import { describe, expect, it } from "vitest";
import { canSubmitAiCandidate, getCandidateAiSubmitBlocker, hasResumeInput } from "./candidateAi";

describe("candidate AI helpers", () => {
  it("detects whether resume input is available", () => {
    expect(hasResumeInput(1, "")).toBe(true);
    expect(hasResumeInput(0, "  HRBP 简历  ")).toBe(true);
    expect(hasResumeInput(0, "")).toBe(false);
  });

  it("requires a target job and candidate name before AI evaluation", () => {
    expect(canSubmitAiCandidate("job-1", "张三")).toBe(true);
    expect(canSubmitAiCandidate("", "张三")).toBe(false);
    expect(canSubmitAiCandidate("job-1", "")).toBe(false);
  });

  it("returns the first blocker for the AI create flow", () => {
    expect(getCandidateAiSubmitBlocker({ resumeParsed: false })).toBe("请选择目标岗位");
    expect(getCandidateAiSubmitBlocker({ jobId: "job-1", resumeParsed: false })).toBe("请先识别简历并确认候选人信息");
    expect(getCandidateAiSubmitBlocker({ jobId: "job-1", resumeParsed: true, name: "" })).toBe("请补充候选人姓名");
    expect(getCandidateAiSubmitBlocker({ jobId: "job-1", resumeParsed: true, name: "张三" })).toBe("");
  });
});
