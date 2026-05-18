import { describe, expect, it, vi } from "vitest";
import { AiService } from "./ai.service";

const evaluationResult = {
  match_score: 72,
  level: "yellow",
  recommendation: "send_to_hiring_manager_review",
  summary: "候选人有相关经验，建议用人经理快审。",
  score_breakdown: {
    skill_match: { score: 18, max_score: 25, reason: "技能部分匹配" },
    project_match: { score: 18, max_score: 25, reason: "项目经验部分匹配" },
    business_match: { score: 10, max_score: 15, reason: "业务经验部分匹配" },
    level_match: { score: 10, max_score: 15, reason: "层级基本匹配" },
    stability: { score: 8, max_score: 10, reason: "稳定性未见明显风险" },
    salary_city_match: { score: 8, max_score: 10, reason: "城市匹配" }
  },
  reasons: ["HRBP经验匹配"],
  risks: ["业务复杂度待确认"],
  questions_to_confirm: ["是否支持过研发团队？"],
  evidence: [],
  missing_information: [],
  suggested_next_step: "进入用人经理快审"
};

describe("AiService resume evaluation status persistence", () => {
  it("persists running and completed status on the application", async () => {
    const { service, prisma } = createService({ data: evaluationResult, usage: { prompt_tokens: 1, completion_tokens: 1 } });

    await service.generateResumeEvaluation({ candidateId: "candidate-1", jobId: "job-1", mode: "sync" }, "user-1");

    expect(prisma.application.update).toHaveBeenCalledWith({
      where: { id: "application-1" },
      data: { nextAction: "AI_EVALUATION_RUNNING" }
    });
    expect(prisma.application.update).toHaveBeenCalledWith({
      where: { id: "application-1" },
      data: expect.objectContaining({
        nextAction: "AI_EVALUATION_COMPLETED",
        matchScore: 72,
        recommendation: "send_to_hiring_manager_review"
      })
    });
  });

  it("persists failed status when evaluation fails", async () => {
    const { service, prisma } = createService(new Error("AI failed"));

    await expect(service.generateResumeEvaluation({ candidateId: "candidate-1", jobId: "job-1", mode: "sync" }, "user-1")).rejects.toThrow(
      "AI failed"
    );

    expect(prisma.application.update).toHaveBeenCalledWith({
      where: { id: "application-1" },
      data: { nextAction: "AI_EVALUATION_RUNNING" }
    });
    expect(prisma.application.update).toHaveBeenCalledWith({
      where: { id: "application-1" },
      data: { nextAction: "AI_EVALUATION_FAILED" }
    });
  });

  it("accepts common loose AI evaluation fields and normalizes them before saving", async () => {
    const { service, prisma } = createService({
      data: {
        decision: "green",
        match_score: 86,
        recommendation: "建议进入 HR 初试",
        summary: "候选人较匹配。",
        dimension_scores: {
          stability: 6,
          level_match: 13,
          skill_match: 23,
          project_match: 22,
          business_match: 13,
          salary_city_match: 9
        },
        reasons: ["HRBP经验匹配"]
      },
      usage: { prompt_tokens: 1, completion_tokens: 1 }
    });

    await service.generateResumeEvaluation({ candidateId: "candidate-1", jobId: "job-1", mode: "sync" }, "user-1");

    expect(prisma.candidateEvaluation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        matchScore: 86,
        level: "green",
        recommendation: "advance_to_hr_screen"
      })
    });
  });
});

function createService(aiResponse: unknown) {
  const prisma = {
    candidate: {
      findUnique: vi.fn().mockResolvedValue({
        id: "candidate-1",
        name: "张三",
        sourceChannel: "简历上传",
        sourceOwnerId: "user-1",
        resumeText: "6年HRBP经验",
        tags: ["HRBP"],
        currentCompany: null,
        evaluations: []
      }),
      update: vi.fn().mockResolvedValue({})
    },
    job: {
      findUnique: vi.fn().mockResolvedValue({
        id: "job-1",
        title: "HRBP",
        jd: "招聘HRBP",
        profile: null,
        jdVersions: []
      })
    },
    application: {
      upsert: vi.fn().mockResolvedValue({ id: "application-1", stage: "NEW" }),
      update: vi.fn().mockResolvedValue({})
    },
    aiTask: {
      create: vi.fn().mockResolvedValue({ id: "task-1" }),
      update: vi.fn().mockResolvedValue({})
    },
    candidateEvaluation: {
      create: vi.fn().mockResolvedValue({ id: "evaluation-1" })
    }
  };
  const aiProvider = {
    model: "test-model",
    completeJson: vi.fn().mockImplementation(() => {
      if (aiResponse instanceof Error) return Promise.reject(aiResponse);
      return Promise.resolve(aiResponse);
    })
  };

  return { prisma, aiProvider, service: new AiService(prisma as never, aiProvider as never) };
}
