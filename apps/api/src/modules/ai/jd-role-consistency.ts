import type { JdAssistantResult } from "@hiresystem/shared";

export type JobRoleFamily = "hrbp" | "product" | "backend" | "frontend" | "test" | "operations" | "sales";

type RoleDefinition = {
  family: JobRoleFamily;
  label: string;
  keywords: string[];
};

const roleDefinitions: RoleDefinition[] = [
  {
    family: "hrbp",
    label: "HRBP/人力资源业务伙伴",
    keywords: ["hrbp", "人力资源业务伙伴", "人力资源伙伴", "人力资源bp", "hr业务伙伴", "组织发展", "人才发展"]
  },
  {
    family: "product",
    label: "产品经理",
    keywords: ["产品经理", "产品负责人", "产品专家", "产品规划", "需求分析", "需求管理", "product manager", "pm"]
  },
  {
    family: "backend",
    label: "后端",
    keywords: ["后端", "服务端", "java", "golang", "go工程师", "node.js", "python后端"]
  },
  {
    family: "frontend",
    label: "前端",
    keywords: ["前端", "web前端", "react", "vue", "小程序"]
  },
  {
    family: "test",
    label: "测试/质量",
    keywords: ["测试", "qa", "质量保障", "自动化测试", "测试开发"]
  },
  {
    family: "operations",
    label: "运营",
    keywords: ["运营", "用户运营", "内容运营", "活动运营", "增长运营"]
  },
  {
    family: "sales",
    label: "销售",
    keywords: ["销售", "商务", "客户经理", "大客户", "bd"]
  }
];

export type JdRoleConsistencyResult = {
  ok: boolean;
  requestedFamily?: JobRoleFamily;
  generatedFamily?: JobRoleFamily;
  message?: string;
};

export function detectJobRoleFamily(text: string): JobRoleFamily | undefined {
  const normalized = text.toLowerCase();
  return roleDefinitions.find((definition) =>
    definition.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  )?.family;
}

export function validateJdRoleConsistency(input: {
  requestedTexts: Array<string | null | undefined>;
  result: JdAssistantResult;
}): JdRoleConsistencyResult {
  const requestedText = input.requestedTexts.filter(Boolean).join("\n");
  const requestedFamily = detectJobRoleFamily(requestedText);
  if (!requestedFamily) {
    return { ok: true };
  }

  const generatedText = [
    input.result.job_title,
    input.result.external_jd.title,
    input.result.external_jd.job_description.join("\n"),
    input.result.external_jd.requirements.join("\n"),
    input.result.internal_job_profile.mission,
    input.result.internal_job_profile.must_have_skills.join("\n"),
    input.result.internal_job_profile.screening_questions.join("\n")
  ].join("\n");
  const generatedFamily = detectJobRoleFamily(generatedText);

  if (generatedFamily === requestedFamily) {
    return { ok: true, requestedFamily, generatedFamily };
  }

  const requestedLabel = labelForFamily(requestedFamily);
  const generatedLabel = generatedFamily ? labelForFamily(generatedFamily) : "无法识别的岗位";
  return {
    ok: false,
    requestedFamily,
    generatedFamily,
    message: `AI JD 岗位类型不一致：用户要的是${requestedLabel}，但生成结果像${generatedLabel}。`
  };
}

export function buildJdRoleCorrectionPrompt(result: JdRoleConsistencyResult) {
  const requestedLabel = result.requestedFamily ? labelForFamily(result.requestedFamily) : "用户指定岗位";
  return [
    "上一次生成的 JD 岗位类型不符合用户输入，必须重写。",
    `目标岗位只能是：${requestedLabel}。`,
    "不要生成产品经理、技术、运营、销售等其他岗位，除非用户明确要求。",
    "请重新输出完整 JSON，字段结构不变。"
  ].join("\n");
}

function labelForFamily(family: JobRoleFamily) {
  return roleDefinitions.find((definition) => definition.family === family)?.label ?? family;
}
