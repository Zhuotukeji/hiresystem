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
