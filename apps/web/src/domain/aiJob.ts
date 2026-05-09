export type JdAssistantResult = {
  job_title: string;
  external_jd: {
    title: string;
    location?: string;
    salary_range?: string;
    department?: string;
    job_description: string[];
    requirements: string[];
    nice_to_have: string[];
    company_pitch?: string;
  };
};

export type AiDraftJobValues = {
  title?: string;
  department?: string;
  city?: string;
  priority?: string;
  headcount?: number;
  salaryMin?: number;
  salaryMax?: number;
};

export function canStartAiJobGeneration(input: { prompt: string; isPending?: boolean }) {
  return Boolean(input.prompt.trim()) && !input.isPending;
}

export function validateAiJdInput(values: AiDraftJobValues, prompt: string) {
  const titleFamily = detectRoleFamily(values.title ?? "");
  const promptFamily = detectRoleFamily(prompt);
  if (titleFamily && promptFamily && titleFamily !== promptFamily) {
    return {
      ok: false,
      message: "岗位名称和需求描述像是两个不同岗位，请先统一后再生成 JD。"
    };
  }
  return { ok: true };
}

export function buildDraftJobPayload(values: AiDraftJobValues, prompt: string) {
  return {
    title: values.title?.trim() || "AI生成岗位草稿",
    department: values.department,
    city: values.city,
    priority: values.priority ?? "P1",
    headcount: values.headcount ?? 1,
    salaryMin: values.salaryMin,
    salaryMax: values.salaryMax,
    jd: prompt
  };
}

function detectRoleFamily(text: string) {
  const normalized = text.toLowerCase();
  const definitions = [
    { family: "hrbp", keywords: ["hrbp", "人力资源业务伙伴", "人力资源bp", "hr业务伙伴", "组织发展", "人才发展"] },
    { family: "product", keywords: ["产品经理", "产品负责人", "产品规划", "需求分析", "需求管理", "product manager", "pm"] },
    { family: "backend", keywords: ["后端", "服务端", "java", "golang", "go工程师"] },
    { family: "frontend", keywords: ["前端", "react", "vue"] },
    { family: "test", keywords: ["测试", "qa", "质量保障", "测试开发"] },
    { family: "operations", keywords: ["运营", "用户运营", "内容运营", "增长运营"] },
    { family: "sales", keywords: ["销售", "商务", "客户经理", "大客户", "bd"] }
  ];
  return definitions.find((definition) =>
    definition.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
  )?.family;
}

export function formatJdPreview(result: JdAssistantResult) {
  const jd = result.external_jd;
  return [
    `# ${jd.title}`,
    jd.location ? `工作地点：${jd.location}` : "",
    jd.salary_range ? `薪资范围：${jd.salary_range}` : "",
    jd.department ? `所属部门：${jd.department}` : "",
    "",
    "## 岗位职责",
    ...jd.job_description.map((item) => `- ${item}`),
    "",
    "## 任职要求",
    ...jd.requirements.map((item) => `- ${item}`),
    jd.nice_to_have.length ? "\n## 加分项" : "",
    ...jd.nice_to_have.map((item) => `- ${item}`),
    jd.company_pitch ? `\n${jd.company_pitch}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}
