import { describe, expect, it, vi } from "vitest";
import { AiService } from "./ai.service";

describe("AiService resume parse", () => {
  it("uses AI precise parsing and merges safe local fallback fields", async () => {
    const token = "ca02b7bad64ceed11HB63N24FFVQx466VfyZWOCrmfbVMhVk";
    const { service, aiProvider } = createService({
      name: "王五",
      phone: "",
      email: "",
      wechat: token,
      currentCompanyName: "上海米动科技有限公司",
      currentTitle: "HRBP",
      city: "上海",
      yearsOfExperience: 6,
      tags: ["HRBP", token],
      aiSummary: "6年HRBP经验，负责绩效管理和组织发展。"
    });

    const response = await service.parseResume({
      resumeText: `
${token}
姓名：王五
手机：13800138000
2021.03-至今 上海米动科技有限公司 HRBP
负责绩效管理、组织发展和业务团队人才盘点。
`
    });

    expect(response.status).toBe("completed");
    expect(response.result.name).toBe("王五");
    expect(response.result.phone).toBe("13800138000");
    expect(response.result.wechat).toBe("");
    expect(response.result.currentCompanyName).toBe("上海米动科技有限公司");
    expect(response.result.currentTitle).toBe("HRBP");
    expect(JSON.stringify(response.result)).not.toContain(token);
    expect(aiProvider.completeJson).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("local_guess")
        })
      ]),
      expect.objectContaining({ temperature: 0 })
    );
  });

  it("falls back to local parsing when AI parsing fails", async () => {
    const { service } = createService(new Error("timeout"));

    const response = await service.parseResume({
      resumeText: "李四\n8年Java后端研发经验，熟悉Spring、MySQL、Redis。\n北京"
    });

    expect(response.status).toBe("local_completed");
    expect(response.ai_parse_status).toBe("failed");
    expect(response.result.name).toBe("李四");
    expect(response.result.currentTitle).toBe("后端工程师");
  });
});

function createService(aiResponse: unknown) {
  const prisma = {
    aiTask: {
      create: vi.fn().mockResolvedValue({ id: "task-1" }),
      update: vi.fn().mockResolvedValue({})
    }
  };
  const aiProvider = {
    model: "test-model",
    completeJson: vi.fn().mockImplementation(() => {
      if (aiResponse instanceof Error) return Promise.reject(aiResponse);
      return Promise.resolve({ data: aiResponse, usage: { prompt_tokens: 1, completion_tokens: 1 } });
    })
  };

  return { prisma, aiProvider, service: new AiService(prisma as never, aiProvider as never) };
}
