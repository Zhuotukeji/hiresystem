import { describe, expect, it } from "vitest";
import { buildResumeEvaluationInput, compactText, getResumeEvaluationInputMetrics } from "./resume-evaluation-input";

describe("resume evaluation input", () => {
  it("builds a concise structured input for AI resume evaluation", () => {
    const input = buildResumeEvaluationInput({
      candidate: {
        id: "candidate-1",
        name: "张三",
        currentCompanyName: "某互联网公司",
        currentTitle: "HRBP",
        yearsOfExperience: 6,
        city: "上海",
        expectedSalary: "30k",
        resumeText: "负责组织诊断、绩效管理、人才盘点",
        aiSummary: "6年 HRBP 经验",
        tags: ["HRBP", "组织发展"],
        currentCompany: {
          name: "某互联网公司",
          industry: "互联网",
          businessTags: ["SaaS"]
        },
        evaluations: [
          {
            matchScore: 78,
            level: "green",
            recommendation: "advance_to_hr_screen",
            summary: "历史判断匹配",
            reasons: ["HRBP经验匹配"],
            risks: ["业务复杂度待确认"]
          }
        ]
      },
      job: {
        id: "job-1",
        title: "HRBP",
        department: "人力资源部",
        city: "上海",
        salaryMin: 25000,
        salaryMax: 35000,
        jd: "支持业务团队组织发展和绩效落地",
        profile: {
          mission: "支持业务团队组织诊断",
          mustHaveSkills: ["HRBP", "组织发展"],
          knockoutRules: ["只有招聘执行经验"]
        },
        jdVersions: []
      },
      application: {
        id: "application-1",
        stage: "NEW"
      }
    });

    expect(input.task).toBe("resume_evaluation");
    expect(input.candidate_profile.current_title).toBe("HRBP");
    expect(input.target_job.profile.must_have_skills).toContain("HRBP");
    expect(input.scoring_policy.decision_mapping.green).toContain("HR");
    expect(input.recent_evaluation_samples[0].summary).toBe("历史判断匹配");
  });

  it("truncates long resume and JD text before sending to AI", () => {
    const longText = "业务经验".repeat(5000);
    const input = buildResumeEvaluationInput({
      candidate: { id: "candidate-1", name: "张三", resumeText: longText },
      job: { id: "job-1", title: "HRBP", jd: longText, profile: null },
      application: { id: "application-1", stage: "NEW" }
    });
    const metrics = getResumeEvaluationInputMetrics(input);

    expect(metrics.resumeChars).toBeLessThanOrEqual(12_000);
    expect(metrics.jdChars).toBeLessThanOrEqual(6_000);
    expect(input.resume_evidence.resume_text).toContain("中间内容已省略");
  });

  it("normalizes and compacts text while keeping the ending evidence", () => {
    const compacted = compactText(`开头${"x".repeat(300)}结尾`, 120);

    expect(compacted).toContain("开头");
    expect(compacted).toContain("结尾");
    expect(compacted.length).toBeLessThanOrEqual(120);
  });
});
