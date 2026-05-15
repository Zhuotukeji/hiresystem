import { describe, expect, it } from "vitest";
import {
  interviewKitResultSchema,
  jdAssistantResultSchema,
  resumeEvaluationResultSchema,
  resumeParseResultSchema,
  stageHandoffResultSchema
} from "@hiresystem/shared";

describe("AI result schemas", () => {
  it("validates resume evaluation result", () => {
    const result = resumeEvaluationResultSchema.parse({
      match_score: 78,
      level: "green",
      recommendation: "advance_to_hr_screen",
      summary: "技术栈和交易系统经验匹配。",
      score_breakdown: {
        skill_match: { score: 22, max_score: 25, reason: "Java匹配" },
        project_match: { score: 21, max_score: 25, reason: "订单项目匹配" },
        business_match: { score: 12, max_score: 15, reason: "电商背景" },
        level_match: { score: 10, max_score: 15, reason: "年限合适" },
        stability: { score: 6, max_score: 10, reason: "有换工作记录" },
        salary_city_match: { score: 7, max_score: 10, reason: "城市匹配" }
      },
      reasons: [],
      risks: [],
      questions_to_confirm: [],
      evidence: [],
      missing_information: [],
      suggested_next_step: "建议HR初筛"
    });
    expect(result.match_score).toBe(78);
  });

  it("validates resume parse result", () => {
    const result = resumeParseResultSchema.parse({
      name: "张三",
      phone: "13800000000",
      email: "zhangsan@example.com",
      currentCompanyName: "某互联网公司",
      currentTitle: "HRBP",
      city: "上海",
      yearsOfExperience: "6年",
      educationSummary: "本科，人力资源管理",
      tags: ["HRBP", "组织发展"],
      aiSummary: "候选人有 HRBP 和组织发展经验。",
      resumeText: "张三，6年HRBP经验"
    });
    expect(result.yearsOfExperience).toBe(6);
    expect(result.tags).toContain("HRBP");
  });

  it("validates JD assistant result", () => {
    const result = jdAssistantResultSchema.parse({
      job_title: "高级后端工程师",
      external_jd: {
        title: "高级后端工程师",
        location: "上海",
        salary_range: "30k-45k",
        department: "技术部",
        job_description: ["负责订单系统"],
        requirements: ["5年以上Java经验"],
        nice_to_have: ["交易系统经验"],
        company_pitch: "参与核心系统建设"
      },
      internal_job_profile: {
        mission: "重构订单链路",
        must_have_skills: ["Java"],
        nice_to_have_skills: ["Kafka"],
        key_project_experience: ["复杂业务系统"],
        knockout_rules: ["只有简单CRUD经验"],
        flexible_rules: [],
        screening_questions: ["项目角色是什么？"],
        interview_dimensions: ["技术深度"],
        sourcing_keywords: ["Java 订单系统"],
        target_company_types: ["电商"]
      }
    });
    expect(result.internal_job_profile.must_have_skills).toContain("Java");
  });

  it("validates interview kit and stage handoff results", () => {
    expect(
      interviewKitResultSchema.parse({
        stage: "first_interview",
        goal: "验证项目深度",
        focus_areas: ["项目真实性"],
        must_ask_questions: [{ question: "讲一个核心项目", evaluation_points: ["个人贡献"], purpose: "验证深度" }],
        resume_based_questions: [],
        case_questions: [],
        good_signals: [],
        bad_signals: [],
        pass_criteria: [],
        red_flags: []
      }).stage
    ).toBe("first_interview");

    expect(
      stageHandoffResultSchema.parse({
        candidate_summary: "5年Java经验",
        current_stage: "first_interview",
        next_stage: "second_interview",
        why_advance: ["项目真实"],
        remaining_risks: ["系统设计待验证"],
        next_interview_focus: ["系统设计"],
        recommended_questions: [],
        previous_feedback_summary: "一面通过"
      }).next_stage
    ).toBe("second_interview");
  });
});
