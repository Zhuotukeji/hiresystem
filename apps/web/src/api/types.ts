export type User = {
  sub?: string;
  id?: string;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PermissionResource = "CANDIDATE" | "TARGET_COMPANY" | "JOB";

export type PermissionAction = "DELETE";

export type RolePermission = {
  role: string;
  resource: PermissionResource;
  action: PermissionAction;
  allowed: boolean;
  locked?: boolean;
};

export type CurrentPermissions = {
  role: string;
  permissions: RolePermission[];
  can: Record<PermissionResource, Record<PermissionAction, boolean>>;
};

export type Candidate = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  currentCompanyName?: string;
  currentTitle?: string;
  city?: string;
  yearsOfExperience?: number;
  expectedSalary?: string;
  sourceChannel?: string;
  resumeText?: string;
  aiSummary?: string;
  tags: string[];
  status: string;
  applications?: Application[];
  evaluations?: CandidateEvaluation[];
};

export type TargetCompany = {
  id: string;
  name: string;
  companyType?: string;
  industry?: string;
  city?: string;
  talentQualityLevel?: string;
  sourcingPriority?: string;
  businessTags: string[];
  techTags: string[];
  targetRoles: string[];
  riskNotes?: string;
  _count?: { candidates: number };
};

export type Job = {
  id: string;
  title: string;
  department?: string;
  city?: string;
  priority: string;
  status: string;
  headcount: number;
  salaryMin?: number;
  salaryMax?: number;
  jd?: string;
  profile?: JobProfile;
  applications?: Application[];
  jdVersions?: Array<{ id: string; versionNo: number; jdContent: string; createdAt: string }>;
  _count?: { applications: number };
};

export type JobProfile = {
  id?: string;
  mission?: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  targetCompanies: string[];
  excludedCompanies: string[];
  targetTitles: string[];
  targetLevels: string[];
  keyProjectExperience: string[];
  knockoutRules: string[];
  flexibleRules: string[];
  screeningQuestions: string[];
  interviewDimensions: string[];
  passScore: number;
  yellowScoreMin: number;
  yellowScoreMax: number;
};

export type Application = {
  id: string;
  candidateId: string;
  jobId: string;
  stage: string;
  source?: string;
  matchScore?: number;
  recommendation?: string;
  nextAction?: string;
  nextActionDueAt?: string;
  candidate?: Candidate;
  job?: Job;
  evaluations?: CandidateEvaluation[];
  interviewKits?: InterviewKit[];
  interviews?: Interview[];
};

export type CandidateEvaluation = {
  id: string;
  matchScore: number;
  level: string;
  recommendation: string;
  summary: string;
  scoreBreakdown: Record<string, { score: number; max_score: number; reason: string }>;
  reasons: string[];
  risks: string[];
  questionsToConfirm: string[];
  evidence?: Array<{ type: string; text: string }>;
  missingInformation: string[];
  suggestedNextStep?: string;
  job?: Job;
  createdAt: string;
};

export type ResumeParseResult = {
  name: string;
  phone?: string;
  email?: string;
  wechat?: string;
  currentCompanyName?: string;
  currentTitle?: string;
  currentLevel?: string;
  city?: string;
  yearsOfExperience?: number | null;
  educationSummary?: string;
  expectedSalary?: string;
  currentSalary?: string;
  availability?: string;
  jobIntention?: string;
  sourceChannel?: string;
  tags: string[];
  aiSummary?: string;
  resumeText: string;
};

export type ResumeEvaluationResponse = {
  evaluation_id?: string;
  status: string;
  interview_kit_status?: string;
  candidate_id?: string;
  job_id?: string;
  application_id?: string;
  result?: {
    match_score: number;
    level: string;
    recommendation: string;
    summary: string;
    reasons: string[];
    risks: string[];
    questions_to_confirm: string[];
    suggested_next_step?: string;
  };
};

export type InterviewKit = {
  id: string;
  stage: string;
  goal: string;
  focusAreas: string[];
  mustAskQuestions: Array<{ question: string; evaluation_points: string[]; purpose?: string }>;
  resumeBasedQuestions: Array<{ question: string; evaluation_points: string[]; purpose?: string }>;
  caseQuestions: Array<{ question: string; evaluation_points: string[]; purpose?: string }>;
  goodSignals: string[];
  badSignals: string[];
  passCriteria: string[];
  redFlags: string[];
};

export type Interview = {
  id: string;
  interviewRound: string;
  scheduledAt?: string;
  status: string;
  feedback?: unknown;
  interviewer?: Pick<User, "id" | "name" | "email">;
  candidate?: Candidate;
  job?: Job;
};

export type InterviewTask = {
  interviewId: string;
  candidateId: string;
  candidateName: string;
  candidateTitle?: string;
  candidateCompany?: string;
  jobId: string;
  jobTitle: string;
  jobDepartment?: string;
  interviewRound: string;
  status: string;
  scheduledAt?: string;
  createdAt: string;
  hasFeedback: boolean;
};

export type InterviewerOption = Pick<User, "id" | "name" | "email" | "role">;
