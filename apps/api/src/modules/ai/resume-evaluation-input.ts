type JsonRecord = Record<string, unknown>;

export type ResumeEvaluationInputParams = {
  candidate: JsonRecord;
  job: JsonRecord;
  application: JsonRecord;
};

const RESUME_TEXT_LIMIT = 8_000;
const JD_TEXT_LIMIT = 3_000;
const TEXT_FIELD_LIMIT = 360;

export function buildResumeEvaluationInput({ candidate, job, application }: ResumeEvaluationInputParams) {
  const profile = asRecord(job.profile);
  const currentCompany = asRecord(candidate.currentCompany);
  const latestJdVersion = Array.isArray(job.jdVersions) ? asRecord(job.jdVersions[0]) : {};
  const resumeText = compactText(candidate.resumeText, RESUME_TEXT_LIMIT);
  const jdText = compactText(firstText(job.jd, latestJdVersion.jdContent), JD_TEXT_LIMIT);

  return {
    task: "resume_evaluation",
    mode: "fast_structured_decision",
    decision_goal: "判断候选人是否匹配目标岗位，以及是否进入 HR 初试或下一阶段。",
    output_expectation: {
      be_concise: true,
      summary_max_chars: 100,
      max_reasons: 3,
      max_risks: 3,
      max_questions_to_confirm: 3,
      do_not_repeat_resume_or_jd: true
    },
    candidate_profile: {
      id: text(candidate.id),
      name: text(candidate.name),
      current_company: text(candidate.currentCompanyName),
      current_title: text(candidate.currentTitle),
      current_level: text(candidate.currentLevel),
      city: text(candidate.city),
      years_of_experience: candidate.yearsOfExperience ?? null,
      education: text(candidate.educationSummary),
      current_salary: text(candidate.currentSalary),
      expected_salary: text(candidate.expectedSalary),
      availability: text(candidate.availability),
      job_intention: text(candidate.jobIntention),
      source_channel: text(candidate.sourceChannel),
      ai_summary: compactText(candidate.aiSummary, TEXT_FIELD_LIMIT),
      tags: compactList(candidate.tags, 10)
    },
    resume_evidence: {
      resume_text: resumeText,
      resume_text_chars: resumeText.length
    },
    target_job: {
      id: text(job.id),
      title: text(job.title),
      department: text(job.department),
      city: text(job.city),
      priority: text(job.priority),
      status: text(job.status),
      headcount: job.headcount ?? null,
      salary_range: formatSalaryRange(job.salaryMin, job.salaryMax),
      jd_text: jdText,
      jd_text_chars: jdText.length,
      profile: {
        mission: compactText(profile.mission, TEXT_FIELD_LIMIT),
        must_have_skills: compactList(profile.mustHaveSkills, 8),
        nice_to_have_skills: compactList(profile.niceToHaveSkills, 6),
        target_companies: compactList(profile.targetCompanies, 6),
        excluded_companies: compactList(profile.excludedCompanies, 6),
        target_titles: compactList(profile.targetTitles, 6),
        target_levels: compactList(profile.targetLevels, 6),
        target_years_min: profile.targetYearsMin ?? null,
        target_years_max: profile.targetYearsMax ?? null,
        key_project_experience: compactList(profile.keyProjectExperience, 6),
        knockout_rules: compactList(profile.knockoutRules, 6),
        flexible_rules: compactList(profile.flexibleRules, 6),
        screening_questions: compactList(profile.screeningQuestions, 5),
        interview_dimensions: compactList(profile.interviewDimensions, 5),
        pass_score: profile.passScore ?? 75,
        yellow_score_min: profile.yellowScoreMin ?? 60,
        yellow_score_max: profile.yellowScoreMax ?? 74
      }
    },
    target_company_context: {
      name: text(currentCompany.name || candidate.currentCompanyName),
      industry: text(currentCompany.industry),
      company_type: text(currentCompany.companyType),
      talent_quality_level: text(currentCompany.talentQualityLevel),
      sourcing_priority: text(currentCompany.sourcingPriority),
      business_tags: compactList(currentCompany.businessTags, 8),
      tech_tags: compactList(currentCompany.techTags, 8),
      target_roles: compactList(currentCompany.targetRoles, 8),
      risk_notes: compactText(currentCompany.riskNotes, TEXT_FIELD_LIMIT)
    },
    current_application: {
      id: text(application.id),
      stage: text(application.stage),
      source: text(application.source),
      previous_match_score: application.matchScore ?? null,
      previous_recommendation: text(application.recommendation)
    },
    recent_evaluation_samples: compactEvaluations(candidate.evaluations),
    scoring_policy: {
      total_score: 100,
      dimensions: {
        skill_match: 25,
        project_match: 25,
        business_match: 15,
        level_match: 15,
        stability: 10,
        salary_city_match: 10
      },
      decision_mapping: {
        green: "明显匹配，建议进入 HR 初试",
        yellow: "有潜力但需用人经理快审",
        red: "当前岗位不匹配，进入人才池或拒绝",
        gray: "信息不足，需要补充信息"
      }
    }
  };
}

export function getResumeEvaluationInputMetrics(input: ReturnType<typeof buildResumeEvaluationInput>) {
  return {
    totalChars: JSON.stringify(input).length,
    resumeChars: input.resume_evidence.resume_text.length,
    jdChars: input.target_job.jd_text.length
  };
}

export function compactText(value: unknown, maxChars: number) {
  const normalized = text(value)
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (normalized.length <= maxChars) return normalized;

  const marker = `\n\n[中间内容已省略，原文共${normalized.length}字]\n\n`;
  const headLength = Math.max(0, Math.floor((maxChars - marker.length) * 0.7));
  const tailLength = Math.max(0, maxChars - marker.length - headLength);
  return `${normalized.slice(0, headLength)}${marker}${normalized.slice(-tailLength)}`;
}

function compactEvaluations(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 2).map((item) => {
    const evaluation = asRecord(item);
    return {
      match_score: evaluation.matchScore ?? null,
      level: text(evaluation.level),
      recommendation: text(evaluation.recommendation),
      summary: compactText(evaluation.summary, TEXT_FIELD_LIMIT),
      reasons: compactList(evaluation.reasons, 3),
      risks: compactList(evaluation.risks, 3),
      suggested_next_step: compactText(evaluation.suggestedNextStep, TEXT_FIELD_LIMIT)
    };
  });
}

function compactList(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => compactText(item, 160)).filter(Boolean).slice(0, maxItems);
}

function formatSalaryRange(min: unknown, max: unknown) {
  if (min && max) return `${min}-${max}`;
  if (min) return `${min}+`;
  if (max) return `<=${max}`;
  return "";
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const content = text(value);
    if (content) return content;
  }
  return "";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}
