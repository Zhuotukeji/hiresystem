import { describe, expect, it, vi } from "vitest";
import { AiService } from "./ai.service";

describe("AiService interview kit generation", () => {
  it("stores JSON-safe task snapshots and normalizes loose AI kit output", async () => {
    const { service, prisma } = createService();

    const result = await service.generateInterviewKit("application-1", "first_interview", "user-1");

    expect(result.status).toBe("completed");
    expect(result.result.stage).toBe("first_interview");
    expect(result.result.must_ask_questions[0].question).toBe("请介绍一个最复杂的项目");
    const taskCreateArg = prisma.aiTask.create.mock.calls[0][0];
    expect(typeof taskCreateArg.data.inputSnapshot.candidate.createdAt).toBe("string");
    expect(taskCreateArg.data.inputSnapshot.candidate.createdAt).toContain("2026-01-01");
    expect(prisma.interviewKit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stage: "first_interview",
          mustAskQuestions: [{ question: "请介绍一个最复杂的项目", evaluation_points: ["个人贡献"], purpose: "验证项目深度" }]
        })
      })
    );
  });

  it("creates a fallback interview kit when AI generation fails", async () => {
    const { service, prisma } = createService(new Error("upstream timeout"));

    const result = await service.generateInterviewKit("application-1", "first_interview", "user-1");

    expect(result.status).toBe("fallback_completed");
    expect(result.ai_status).toBe("failed");
    expect(result.result.goal).toContain("AI生成失败");
    expect(result.result.must_ask_questions.length).toBeGreaterThan(0);
    expect(prisma.aiTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1" },
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: "upstream timeout"
        })
      })
    );
    expect(prisma.interviewKit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stage: "first_interview",
          goal: expect.stringContaining("AI生成失败")
        })
      })
    );
  });
});

function createService(aiResult: unknown = {
  data: {
    interviewKit: {
      interviewStage: "一面",
      objective: "验证候选人的项目深度",
      mustAskQuestions: [{ title: "请介绍一个最复杂的项目", evaluationPoints: ["个人贡献"], reason: "验证项目深度" }]
    }
  },
  usage: { prompt_tokens: 1, completion_tokens: 1 }
}) {
  const application = {
    id: "application-1",
    candidateId: "candidate-1",
    jobId: "job-1",
    stage: "FIRST_INTERVIEW",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    candidate: {
      id: "candidate-1",
      name: "张三",
      currentTitle: "HRBP",
      resumeText: "6年HRBP经验",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z")
    },
    job: {
      id: "job-1",
      title: "HRBP",
      jd: "招聘HRBP",
      profile: {
        mission: "支持业务团队组织发展",
        mustHaveSkills: ["HRBP"],
        interviewDimensions: ["业务理解", "组织诊断"]
      },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z")
    },
    evaluations: [],
    interviews: []
  };

  const prisma = {
    application: {
      findUnique: vi.fn().mockResolvedValue(application)
    },
    aiTask: {
      create: vi.fn().mockResolvedValue({ id: "task-1" }),
      update: vi.fn().mockResolvedValue({})
    },
    interviewKit: {
      create: vi.fn().mockResolvedValue({ id: "kit-1" })
    }
  };
  const aiProvider = {
    model: "test-model",
    completeJson: aiResult instanceof Error ? vi.fn().mockRejectedValue(aiResult) : vi.fn().mockResolvedValue(aiResult)
  };

  return { prisma, service: new AiService(prisma as never, aiProvider as never) };
}
