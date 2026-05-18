type JsonObject = Record<string, unknown>;

export function normalizeJdAssistantPayload(raw: unknown) {
  const payload = asObject(raw);
  const external = asObject(payload.external_jd ?? payload.jd ?? payload.externalJd);
  const internal = asObject(payload.internal_job_profile ?? payload.job_profile ?? payload.internalJobProfile);

  const title = firstText(payload.job_title, external.title, external.job_title, internal.role_name, internal.title);
  const companyPitch =
    firstText(external.company_pitch, external.job_summary, external.summary) ||
    toStringArray(external.job_highlights).join("\n");

  return {
    job_title: title,
    external_jd: {
      title,
      location: firstText(external.location, internal.compensation && asObject(internal.compensation).location),
      salary_range: firstText(
        external.salary_range,
        external.salary,
        internal.compensation && asObject(internal.compensation).salary_range
      ),
      department: firstText(external.department),
      job_description: toStringArray(
        external.job_description ?? external.responsibilities ?? external.duties ?? external.responsibility
      ),
      requirements: toStringArray(external.requirements ?? external.qualifications ?? external.must_have),
      nice_to_have: toStringArray(
        external.nice_to_have ?? external.preferred_qualifications ?? external.preferred ?? external.plus
      ),
      company_pitch: companyPitch
    },
    internal_job_profile: {
      mission:
        firstText(internal.mission, internal.hiring_reason) ||
        toStringArray(internal.responsibility_scope).join("\n"),
      must_have_skills: toStringArray(internal.must_have_skills ?? internal.must_have ?? external.keywords),
      nice_to_have_skills: toStringArray(internal.nice_to_have_skills ?? internal.preferred_skills),
      key_project_experience: toStringArray(
        internal.key_project_experience ?? internal.core_experience ?? internal.project_experience
      ),
      knockout_rules: toStringArray(internal.knockout_rules ?? internal.risks_to_avoid),
      flexible_rules: toStringArray(internal.flexible_rules),
      screening_questions: toStringArray(internal.screening_questions ?? internal.interview_questions),
      interview_dimensions: toStringArray(internal.interview_dimensions ?? internal.screening_focus),
      sourcing_keywords: toStringArray(internal.sourcing_keywords ?? external.keywords),
      target_company_types: toStringArray(internal.target_company_types ?? internal.target_company_type)
    }
  };
}

export function normalizeResumeParsePayload(raw: unknown, resumeText: string) {
  const payload = asObject(raw);
  const candidate = asObject(payload.candidate ?? payload.profile ?? payload.basic_info);
  const source = Object.keys(candidate).length ? candidate : payload;

  return {
    name: firstText(source.name, source.candidate_name, source.full_name),
    phone: firstText(source.phone, source.mobile, source.phone_number, source.tel),
    email: firstText(source.email, source.mail),
    wechat: firstText(source.wechat, source.wechat_id, source.weixin),
    currentCompanyName: firstText(source.currentCompanyName, source.current_company, source.company),
    currentTitle: firstText(source.currentTitle, source.current_title, source.title, source.position),
    currentLevel: firstText(source.currentLevel, source.current_level, source.level),
    city: firstText(source.city, source.location, source.current_city),
    yearsOfExperience: source.yearsOfExperience ?? source.years_of_experience ?? source.work_years ?? null,
    educationSummary: firstText(source.educationSummary, source.education_summary, source.education),
    expectedSalary: firstText(source.expectedSalary, source.expected_salary),
    currentSalary: firstText(source.currentSalary, source.current_salary),
    availability: firstText(source.availability, source.available_time),
    jobIntention: firstText(source.jobIntention, source.job_intention, source.career_goal),
    sourceChannel: firstText(source.sourceChannel, source.source_channel),
    tags: toStringArray(source.tags ?? source.keywords ?? source.skills).slice(0, 8),
    aiSummary: firstText(source.aiSummary, source.ai_summary, source.summary),
    resumeText: firstText(source.resumeText, source.resume_text, payload.resumeText, payload.resume_text) || resumeText
  };
}

export function normalizeResumeEvaluationPayload(raw: unknown) {
  const payload = asObject(raw);
  const scoreBreakdown = asObject(payload.score_breakdown ?? payload.scoreBreakdown ?? payload.dimension_scores ?? payload.dimensionScores);
  const level = normalizeRecommendationLevel(firstText(payload.level, payload.decision, payload.match_level, payload.matchLevel));
  const recommendation = normalizeRecommendationAction(firstText(payload.recommendation, payload.action, payload.next_step, payload.suggested_next_step), level);

  return {
    match_score: toNumber(payload.match_score ?? payload.matchScore ?? payload.score ?? payload.total_score),
    level,
    recommendation,
    summary: firstText(payload.summary, payload.conclusion, payload.reason) || "AI已完成简历匹配判断。",
    score_breakdown: {
      skill_match: normalizeScoreItem(scoreBreakdown.skill_match ?? scoreBreakdown.skillMatch, 25, "技能匹配"),
      project_match: normalizeScoreItem(scoreBreakdown.project_match ?? scoreBreakdown.projectMatch, 25, "项目经验匹配"),
      business_match: normalizeScoreItem(scoreBreakdown.business_match ?? scoreBreakdown.businessMatch, 15, "业务背景匹配"),
      level_match: normalizeScoreItem(scoreBreakdown.level_match ?? scoreBreakdown.levelMatch, 15, "层级匹配"),
      stability: normalizeScoreItem(scoreBreakdown.stability, 10, "稳定性"),
      salary_city_match: normalizeScoreItem(
        scoreBreakdown.salary_city_match ?? scoreBreakdown.salaryCityMatch ?? scoreBreakdown.salary_match ?? scoreBreakdown.city_match,
        10,
        "薪资和城市匹配"
      )
    },
    reasons: toStringArray(payload.reasons ?? payload.reason_list ?? payload.strengths).slice(0, 4),
    risks: toStringArray(payload.risks ?? payload.risk_points ?? payload.concerns).slice(0, 4),
    questions_to_confirm: toStringArray(
      payload.questions_to_confirm ?? payload.questionsToConfirm ?? payload.confirm_questions ?? payload.questions
    ).slice(0, 5),
    evidence: normalizeEvidence(payload.evidence),
    missing_information: toStringArray(payload.missing_information ?? payload.missingInformation ?? payload.missing).slice(0, 5),
    suggested_next_step: firstText(payload.suggested_next_step, payload.suggestedNextStep, payload.next_step)
  };
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,，\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeRecommendationLevel(value: string) {
  const text = value.toLowerCase();
  if (["green", "yellow", "red", "gray"].includes(text)) return text;
  if (/强烈|推进|通过|匹配|建议进入|advance|pass|hire/.test(value)) return "green";
  if (/快审|待确认|有潜力|部分|一般|review|maybe/.test(value)) return "yellow";
  if (/拒绝|不匹配|淘汰|reject|no/.test(value)) return "red";
  return "gray";
}

function normalizeRecommendationAction(value: string, level: string) {
  const text = value.toLowerCase();
  if (["advance_to_hr_screen", "send_to_hiring_manager_review", "reject_for_current_job", "add_to_talent_pool", "need_more_information"].includes(text)) {
    return text;
  }
  if (/用人|经理|快审|manager/.test(value)) return "send_to_hiring_manager_review";
  if (/拒绝|不匹配|淘汰|reject/.test(value)) return "reject_for_current_job";
  if (/人才库|人才池|talent/.test(value)) return "add_to_talent_pool";
  if (/补充|更多信息|确认|information|missing/.test(value)) return "need_more_information";
  if (level === "green") return "advance_to_hr_screen";
  if (level === "yellow") return "send_to_hiring_manager_review";
  if (level === "red") return "reject_for_current_job";
  return "need_more_information";
}

function normalizeScoreItem(value: unknown, maxScore: number, fallbackReason: string) {
  const item = asObject(value);
  const score = clampNumber(toNumber(item.score ?? item.value ?? value), 0, maxScore);
  return {
    score,
    max_score: toNumber(item.max_score ?? item.maxScore) || maxScore,
    reason: firstText(item.reason, item.comment) || fallbackReason
  };
}

function normalizeEvidence(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const object = asObject(item);
      return {
        type: firstText(object.type, object.category) || "resume",
        text: firstText(object.text, object.content, item)
      };
    })
    .filter((item) => item.text)
    .slice(0, 5);
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.match(/\d+(?:\.\d+)?/);
    if (match) return Number.parseFloat(match[0]);
  }
  return 0;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
