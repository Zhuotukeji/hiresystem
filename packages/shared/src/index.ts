import { z } from "zod";

export const userRoles = [
  "ADMIN",
  "HR_LEAD",
  "RECRUITER",
  "HIRING_MANAGER",
  "INTERVIEWER",
  "EXECUTIVE"
] as const;

export const candidateStatuses = [
  "NEW",
  "TO_CONTACT",
  "CONTACTED",
  "REPLIED",
  "INTERESTED",
  "NOT_NOW",
  "IN_PROCESS",
  "OFFERED",
  "HIRED",
  "REJECTED",
  "DO_NOT_CONTACT"
] as const;

export const applicationStages = [
  "NEW",
  "HR_SCREEN",
  "MANAGER_REVIEW",
  "FIRST_INTERVIEW",
  "SECOND_INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "TALENT_POOL"
] as const;

export const aiTaskTypes = [
  "RESUME_EVALUATION",
  "JD_CHAT",
  "JD_GENERATION",
  "INTERVIEW_KIT",
  "STAGE_HANDOFF",
  "RESUME_PARSE"
] as const;

export const aiTaskStatuses = ["PENDING", "RUNNING", "COMPLETED", "FAILED"] as const;

export const recommendationLevels = ["green", "yellow", "red", "gray"] as const;

export const recommendationActions = [
  "advance_to_hr_screen",
  "send_to_hiring_manager_review",
  "reject_for_current_job",
  "add_to_talent_pool",
  "need_more_information"
] as const;

export const interviewStages = [
  "hr_screen",
  "first_interview",
  "second_interview",
  "final_interview"
] as const;

export const interviewConclusions = [
  "strong_hire",
  "hire",
  "weak_hire",
  "no_hire",
  "strong_no_hire"
] as const;

export type UserRole = (typeof userRoles)[number];
export type CandidateStatus = (typeof candidateStatuses)[number];
export type ApplicationStage = (typeof applicationStages)[number];
export type RecommendationLevel = (typeof recommendationLevels)[number];
export type RecommendationAction = (typeof recommendationActions)[number];
export type InterviewStage = (typeof interviewStages)[number];

const scoreItemSchema = z.object({
  score: z.number().min(0),
  max_score: z.number().positive(),
  reason: z.string().min(1)
});

export const resumeEvaluationResultSchema = z.object({
  match_score: z.number().min(0).max(100),
  level: z.enum(recommendationLevels),
  recommendation: z.enum(recommendationActions),
  summary: z.string().min(1),
  score_breakdown: z.object({
    skill_match: scoreItemSchema,
    project_match: scoreItemSchema,
    business_match: scoreItemSchema,
    level_match: scoreItemSchema,
    stability: scoreItemSchema,
    salary_city_match: scoreItemSchema
  }),
  reasons: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  questions_to_confirm: z.array(z.string()).default([]),
  evidence: z
    .array(
      z.object({
        type: z.string(),
        text: z.string()
      })
    )
    .default([]),
  missing_information: z.array(z.string()).default([]),
  suggested_next_step: z.string().default("")
});

export const jdAssistantResultSchema = z.object({
  job_title: z.string().min(1),
  external_jd: z.object({
    title: z.string().min(1),
    location: z.string().default(""),
    salary_range: z.string().default(""),
    department: z.string().default(""),
    job_description: z.array(z.string()).default([]),
    requirements: z.array(z.string()).default([]),
    nice_to_have: z.array(z.string()).default([]),
    company_pitch: z.string().default("")
  }),
  internal_job_profile: z.object({
    mission: z.string().default(""),
    must_have_skills: z.array(z.string()).default([]),
    nice_to_have_skills: z.array(z.string()).default([]),
    key_project_experience: z.array(z.string()).default([]),
    knockout_rules: z.array(z.string()).default([]),
    flexible_rules: z.array(z.string()).default([]),
    screening_questions: z.array(z.string()).default([]),
    interview_dimensions: z.array(z.string()).default([]),
    sourcing_keywords: z.array(z.string()).default([]),
    target_company_types: z.array(z.string()).default([])
  })
});

export const interviewQuestionSchema = z.object({
  question: z.string().min(1),
  evaluation_points: z.array(z.string()).default([]),
  purpose: z.string().default("")
});

export const interviewKitResultSchema = z.object({
  stage: z.enum(interviewStages),
  goal: z.string().min(1),
  focus_areas: z.array(z.string()).default([]),
  must_ask_questions: z.array(interviewQuestionSchema).default([]),
  resume_based_questions: z.array(interviewQuestionSchema).default([]),
  case_questions: z.array(interviewQuestionSchema).default([]),
  good_signals: z.array(z.string()).default([]),
  bad_signals: z.array(z.string()).default([]),
  pass_criteria: z.array(z.string()).default([]),
  red_flags: z.array(z.string()).default([])
});

export const stageHandoffResultSchema = z.object({
  candidate_summary: z.string().min(1),
  current_stage: z.string().min(1),
  next_stage: z.string().min(1),
  why_advance: z.array(z.string()).default([]),
  remaining_risks: z.array(z.string()).default([]),
  next_interview_focus: z.array(z.string()).default([]),
  recommended_questions: z.array(interviewQuestionSchema).default([]),
  previous_feedback_summary: z.string().default("")
});

export type ResumeEvaluationResult = z.infer<typeof resumeEvaluationResultSchema>;
export type JdAssistantResult = z.infer<typeof jdAssistantResultSchema>;
export type InterviewKitResult = z.infer<typeof interviewKitResultSchema>;
export type StageHandoffResult = z.infer<typeof stageHandoffResultSchema>;

export function toExternalJdText(result: JdAssistantResult): string {
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
