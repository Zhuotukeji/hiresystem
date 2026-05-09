import { describe, expect, it } from "vitest";
import { jdAssistantResultSchema } from "@hiresystem/shared";
import { normalizeJdAssistantPayload } from "./ai.normalizers";

describe("AI normalizers", () => {
  it("normalizes common JD field variants returned by LLMs", () => {
    const normalized = normalizeJdAssistantPayload({
      external_jd: {
        job_title: "高级后端工程师",
        responsibilities: ["负责订单系统"],
        requirements: ["Java经验"],
        preferred_qualifications: ["交易系统经验"],
        job_summary: "参与核心链路建设"
      },
      internal_job_profile: {
        role_name: "高级后端工程师",
        hiring_reason: "支撑订单系统重构",
        preferred_skills: ["Kafka"],
        core_experience: ["复杂业务系统"],
        risks_to_avoid: ["只有CRUD经验"],
        interview_questions: ["请介绍订单系统项目"],
        target_company_type: ["电商"]
      }
    });

    const parsed = jdAssistantResultSchema.parse(normalized);
    expect(parsed.external_jd.title).toBe("高级后端工程师");
    expect(parsed.external_jd.job_description).toContain("负责订单系统");
    expect(parsed.external_jd.nice_to_have).toContain("交易系统经验");
    expect(parsed.internal_job_profile.key_project_experience).toContain("复杂业务系统");
  });
});
