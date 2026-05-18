import { describe, expect, it } from "vitest";
import { interviewKitResultSchema, jdAssistantResultSchema, resumeEvaluationResultSchema } from "@hiresystem/shared";
import { normalizeInterviewKitPayload, normalizeJdAssistantPayload, normalizeResumeEvaluationPayload } from "./ai.normalizers";

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

  it("normalizes loose resume evaluation payloads returned by LLMs", () => {
    const normalized = normalizeResumeEvaluationPayload({
      decision: "green",
      match_score: 86,
      recommendation: "建议进入 HR 初试",
      summary: "候选人较匹配",
      dimension_scores: {
        stability: 6,
        level_match: 13,
        skill_match: 23,
        project_match: 22,
        business_match: 13,
        salary_city_match: 9
      },
      reasons: ["HRBP经验匹配"],
      risks: ["时间线需确认"],
      questions_to_confirm: ["是否支持过研发团队？"]
    });

    const parsed = resumeEvaluationResultSchema.parse(normalized);
    expect(parsed.level).toBe("green");
    expect(parsed.recommendation).toBe("advance_to_hr_screen");
    expect(parsed.score_breakdown.skill_match.score).toBe(23);
    expect(parsed.score_breakdown.skill_match.max_score).toBe(25);
  });

  it("normalizes loose interview kit payloads returned by LLMs", () => {
    const normalized = normalizeInterviewKitPayload(
      {
        interviewKit: {
          interviewStage: "一面",
          objective: "验证候选人的项目深度和岗位匹配度",
          focusAreas: ["项目真实性", "业务理解"],
          mustAskQuestions: [
            {
              title: "请介绍一个最复杂的项目",
              evaluationPoints: ["个人贡献", "复杂度"],
              reason: "验证项目深度"
            }
          ],
          resumeQuestions: ["简历中提到的绩效项目具体如何落地？"],
          caseQuestions: [
            {
              question: "如果业务负责人拒绝执行绩效改进方案，你会怎么推动？",
              points: ["沟通策略", "业务影响判断"]
            }
          ],
          goodSignals: ["能讲清楚业务问题和干预动作"],
          redFlags: ["只停留在人事流程执行"]
        }
      },
      "first_interview"
    );

    const parsed = interviewKitResultSchema.parse(normalized);
    expect(parsed.stage).toBe("first_interview");
    expect(parsed.must_ask_questions[0].question).toBe("请介绍一个最复杂的项目");
    expect(parsed.must_ask_questions[0].evaluation_points).toContain("个人贡献");
    expect(parsed.case_questions[0].evaluation_points).toContain("沟通策略");
  });
});
