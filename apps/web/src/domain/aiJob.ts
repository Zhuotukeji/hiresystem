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
