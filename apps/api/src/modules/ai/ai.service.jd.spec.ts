import { BadGatewayException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AiService } from "./ai.service";
import type { JdAssistantResult } from "@hiresystem/shared";

describe("AiService JD role consistency", () => {
  it("retries once when AI generates a JD for the wrong role", async () => {
    const { service, aiProvider, prisma } = createService([
      makeAiResponse(makeJd("产品经理", ["负责产品规划和需求分析"], ["3年以上产品经理经验"])),
      makeAiResponse(makeJd("HRBP", ["支持业务团队组织诊断、人才盘点和绩效落地"], ["熟悉 HRBP 工作方法"]))
    ]);

    const result = await service.continueJdChat(
      "session-1",
      { content: "我们要招聘 HRBP，支持业务团队组织发展", saveToJobId: "job-1" },
      "user-1"
    );

    expect(aiProvider.completeJson).toHaveBeenCalledTimes(2);
    expect(result.result.job_title).toBe("HRBP");
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({ title: "HRBP" })
      })
    );
  });

  it("does not save a JD when retry still returns the wrong role", async () => {
    const { service, prisma } = createService([
      makeAiResponse(makeJd("产品经理", ["负责产品规划和需求分析"], ["3年以上产品经理经验"])),
      makeAiResponse(makeJd("产品经理", ["负责产品路线图"], ["产品经理经验"]))
    ]);

    await expect(
      service.continueJdChat("session-1", { content: "招聘 HRBP", saveToJobId: "job-1" }, "user-1")
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(prisma.jdVersion.create).not.toHaveBeenCalled();
    expect(prisma.job.update).not.toHaveBeenCalled();
  });
});

function createService(aiResponses: unknown[]) {
  const prisma = {
    jdChatSession: {
      findUnique: vi.fn().mockResolvedValue({ id: "session-1", jobId: "job-1", messages: [] })
    },
    jdChatMessage: {
      create: vi.fn().mockResolvedValue({})
    },
    job: {
      findUnique: vi.fn().mockResolvedValue({
        id: "job-1",
        title: "HRBP",
        department: "人力资源部",
        city: "上海",
        salaryMin: 20000,
        salaryMax: 35000,
        jd: "招聘 HRBP，支持业务团队组织发展",
        profile: null
      }),
      update: vi.fn().mockResolvedValue({})
    },
    aiTask: {
      create: vi.fn().mockResolvedValue({ id: "task-1" }),
      update: vi.fn().mockResolvedValue({})
    },
    jdVersion: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "version-1" })
    }
  };
  const aiProvider = {
    model: "test-model",
    completeJson: vi.fn().mockImplementation(() => Promise.resolve(aiResponses.shift()))
  };

  return { prisma, aiProvider, service: new AiService(prisma as never, aiProvider as never) };
}

function makeAiResponse(data: JdAssistantResult) {
  return { data, usage: { prompt_tokens: 1, completion_tokens: 1 } };
}

function makeJd(title: string, jobDescription: string[], requirements: string[]): JdAssistantResult {
  return {
    job_title: title,
    external_jd: {
      title,
      location: "上海",
      salary_range: "",
      department: "人力资源部",
      job_description: jobDescription,
      requirements,
      nice_to_have: [],
      company_pitch: ""
    },
    internal_job_profile: {
      mission: jobDescription.join("\n"),
      must_have_skills: requirements,
      nice_to_have_skills: [],
      key_project_experience: [],
      knockout_rules: [],
      flexible_rules: [],
      screening_questions: [],
      interview_dimensions: [],
      sourcing_keywords: [],
      target_company_types: []
    }
  };
}
