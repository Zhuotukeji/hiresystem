import { describe, expect, it } from "vitest";
import { validateJdRoleConsistency } from "./jd-role-consistency";
import type { JdAssistantResult } from "@hiresystem/shared";

describe("JD role consistency", () => {
  it("rejects product manager JD when the requested role is HRBP", () => {
    const result = jdResult("产品经理", ["负责产品规划和需求分析"], ["3年以上产品经理经验"]);

    const consistency = validateJdRoleConsistency({
      requestedTexts: ["我们要招聘 HRBP，支持业务团队组织发展和人才发展"],
      result
    });

    expect(consistency.ok).toBe(false);
    expect(consistency.requestedFamily).toBe("hrbp");
    expect(consistency.generatedFamily).toBe("product");
  });

  it("accepts HRBP JD when the requested role is HRBP", () => {
    const result = jdResult("HRBP", ["支持业务团队组织诊断、人才盘点和绩效落地"], ["熟悉人力资源业务伙伴工作"]);

    const consistency = validateJdRoleConsistency({
      requestedTexts: ["人力资源业务伙伴"],
      result
    });

    expect(consistency.ok).toBe(true);
  });
});

function jdResult(title: string, jobDescription: string[], requirements: string[]): JdAssistantResult {
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
