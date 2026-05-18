import { BadGatewayException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AiTaskStatus, AiTaskType, ApplicationStage, Prisma } from "@prisma/client";
import {
  InterviewKitResult,
  JdAssistantResult,
  ResumeEvaluationResult,
  ResumeParseResult,
  StageHandoffResult,
  interviewKitResultSchema,
  jdAssistantResultSchema,
  resumeEvaluationResultSchema,
  resumeParseResultSchema,
  stageHandoffResultSchema,
  toExternalJdText
} from "@hiresystem/shared";
import { PrismaService } from "../prisma/prisma.service";
import { CreateJdSessionDto, OverrideEvaluationDto, ResumeEvaluationDto, ResumeParseDto, SendJdMessageDto } from "./ai.dto";
import { buildJdRoleCorrectionPrompt, validateJdRoleConsistency } from "./jd-role-consistency";
import {
  normalizeInterviewKitPayload,
  normalizeJdAssistantPayload,
  normalizeResumeEvaluationPayload,
  normalizeResumeParsePayload
} from "./ai.normalizers";
import { AiProvider } from "./ai.provider";
import {
  interviewKitPrompt,
  jdAssistantPrompt,
  jdRoleConsistencyPrompt,
  jsonOnlySystemPrompt,
  resumeEvaluationPrompt,
  resumeParsePrompt,
  stageHandoffPrompt
} from "./ai.prompts";
import { buildResumeEvaluationInput, getResumeEvaluationInputMetrics } from "./resume-evaluation-input";
import { ResumeUploadFile, extractResumeText } from "./resume-extractor";
import { parseResumeLocally } from "./local-resume-parser";

const AI_EVALUATION_RUNNING = "AI_EVALUATION_RUNNING";
const AI_EVALUATION_COMPLETED = "AI_EVALUATION_COMPLETED";
const AI_EVALUATION_FAILED = "AI_EVALUATION_FAILED";

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProvider
  ) {}

  createJdSession(dto: CreateJdSessionDto, userId?: string) {
    return this.prisma.jdChatSession.create({
      data: {
        jobId: dto.jobId,
        userId,
        messages: {
          create: {
            role: "assistant",
            content:
              "我会帮你生成对外JD和内部岗位画像。请先告诉我岗位名称、部门、城市、薪资范围，以及这个人入职后要解决的核心问题。"
          }
        }
      },
      include: { messages: true }
    });
  }

  async parseResume(dto: ResumeParseDto, file?: ResumeUploadFile, userId?: string) {
    const resumeText = await extractResumeText(file, dto.resumeText);
    const localResult = parseResumeLocally(resumeText);
    if (dto.mode === "local") {
      this.logger.log(
        `Resume parsed locally file=${file?.originalname ?? "text"} chars=${resumeText.length} name=${localResult.name || "-"} title=${localResult.currentTitle || "-"}`
      );
      return { status: "local_completed", ai_parse_status: "skipped", result: localResult };
    }

    const inputSnapshot = {
      mode: dto.mode ?? "ai",
      file: file
        ? {
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size
          }
        : null,
      resumeTextChars: resumeText.length,
      resumeTextPreview: this.compactResumeParseText(resumeText, 12_000),
      localGuess: localResult
    };
    const task = await this.createTask(AiTaskType.RESUME_PARSE, inputSnapshot, userId);

    try {
      const response = await this.aiProvider.completeJson(
        [
          { role: "system", content: `${jsonOnlySystemPrompt}\n${resumeParsePrompt}` },
          {
            role: "user",
            content: JSON.stringify({
              task: "resume_parse",
              extraction_mode: "precise",
              local_guess: localResult,
              resume_text_chars: resumeText.length,
              resume_text: this.compactResumeParseText(resumeText, 24_000)
            })
          }
        ],
        { temperature: 0, maxCompletionTokens: 1200 }
      );
      const result = this.mergeResumeParseResults(this.parseResumeResult(response.data, resumeText), localResult, resumeText);
      await this.completeTask(task.id, result, response.usage);
      return { status: "completed", ai_parse_status: "completed", result };
    } catch (error) {
      await this.failTask(task.id, error);
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI resume parse failed, fallback to local parser task=${task.id}: ${message}`);
      return {
        status: "local_completed",
        ai_parse_status: "failed",
        ai_error: this.compactText(message, 240),
        result: localResult
      };
    }
  }

  async continueJdChat(sessionId: string, dto: SendJdMessageDto, userId?: string) {
    const session = await this.prisma.jdChatSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: "asc" } } }
    });
    if (!session) throw new NotFoundException("JD chat session not found");

    await this.prisma.jdChatMessage.create({
      data: { sessionId, role: "user", content: dto.content }
    });

    const jobId = dto.saveToJobId ?? session.jobId;
    const jobContext = jobId
      ? await this.prisma.job.findUnique({
          where: { id: jobId },
          include: { profile: true }
        })
      : null;
    if (jobId && !jobContext) {
      throw new NotFoundException("Job not found");
    }

    const inputSnapshot = {
      sessionId,
      userMessage: dto.content,
      history: this.compactJdChatHistory(session.messages),
      job_context: jobContext
        ? this.compactJdJobContext(jobContext)
        : null
    };
    const task = await this.createTask(AiTaskType.JD_CHAT, inputSnapshot, userId);

    try {
      let response = await this.aiProvider.completeJson([
        { role: "system", content: `${jsonOnlySystemPrompt}\n${jdAssistantPrompt}\n${jdRoleConsistencyPrompt}` },
        {
          role: "user",
          content: JSON.stringify({
            instruction:
              "继续对话。如果信息足够，请输出完整JD JSON；如果信息不足，也输出当前可生成的JSON，并在company_pitch或mission中保持务实，不要编造业务事实。",
            history: inputSnapshot.history,
            latest_user_message: dto.content,
            job_context: inputSnapshot.job_context,
            role_consistency_rule:
              "必须以 latest_user_message 和 job_context 为唯一事实来源。岗位名称、职责、要求必须匹配用户指定岗位；如果用户要求 HRBP/人力资源业务伙伴，不得生成产品经理或其他岗位。"
          })
        }
      ], { temperature: 0.2, maxCompletionTokens: 2200 });
      const parsed = jdAssistantResultSchema.safeParse(normalizeJdAssistantPayload(response.data));
      if (!parsed.success) {
        throw new BadGatewayException(`AI JD output schema mismatch: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`);
      }
      let result = parsed.data;
      let consistency = validateJdRoleConsistency({
        requestedTexts: [
          dto.content,
          inputSnapshot.job_context?.title,
          inputSnapshot.job_context?.department,
          inputSnapshot.job_context?.jd,
          inputSnapshot.job_context?.profile?.mission,
          ...(inputSnapshot.job_context?.profile?.mustHaveSkills ?? [])
        ],
        result
      });
      if (!consistency.ok) {
        response = await this.aiProvider.completeJson(
          [
            { role: "system", content: `${jsonOnlySystemPrompt}\n${jdAssistantPrompt}\n${jdRoleConsistencyPrompt}` },
            {
              role: "user",
              content: JSON.stringify({
                instruction: buildJdRoleCorrectionPrompt(consistency),
                history: inputSnapshot.history,
                latest_user_message: dto.content,
                job_context: inputSnapshot.job_context
              })
            }
          ],
          { temperature: 0.1, maxCompletionTokens: 2200 }
        );
        const retryParsed = jdAssistantResultSchema.safeParse(normalizeJdAssistantPayload(response.data));
        if (!retryParsed.success) {
          throw new BadGatewayException(`AI JD output schema mismatch: ${retryParsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")}`);
        }
        result = retryParsed.data;
        consistency = validateJdRoleConsistency({
          requestedTexts: [
            dto.content,
            inputSnapshot.job_context?.title,
            inputSnapshot.job_context?.department,
            inputSnapshot.job_context?.jd,
            inputSnapshot.job_context?.profile?.mission,
            ...(inputSnapshot.job_context?.profile?.mustHaveSkills ?? [])
          ],
          result
        });
        if (!consistency.ok) {
          throw new BadGatewayException(consistency.message ?? "AI JD role does not match requested job");
        }
      }

      await this.completeTask(task.id, result, response.usage);
      await this.prisma.jdChatMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content: toExternalJdText(result),
          structuredPayload: result as Prisma.InputJsonValue
        }
      });

      let jdVersion = null;
      if (jobId) {
        jdVersion = await this.saveJdVersion(jobId, result, task.id, userId, inputSnapshot);
      }

      return { status: "completed", result, jdVersion };
    } catch (error) {
      await this.failTask(task.id, error);
      throw error;
    }
  }

  private compactJdChatHistory(messages: Array<{ role: string; content: string }>) {
    return messages.slice(-8).map((message) => ({
      role: message.role,
      content: this.compactText(message.content, message.role === "assistant" ? 1800 : 1200)
    }));
  }

  private compactJdJobContext(
    job: {
      id: string;
      title: string;
      department?: string | null;
      city?: string | null;
      salaryMin?: number | null;
      salaryMax?: number | null;
      jd?: string | null;
      profile?: {
        mission?: string | null;
        mustHaveSkills?: string[];
        niceToHaveSkills?: string[];
        keyProjectExperience?: string[];
        knockoutRules?: string[];
        flexibleRules?: string[];
        screeningQuestions?: string[];
        interviewDimensions?: string[];
        targetCompanies?: string[];
        targetTitles?: string[];
        targetLevels?: string[];
      } | null;
    }
  ) {
    return {
      id: job.id,
      title: job.title,
      department: job.department,
      city: job.city,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      jd: this.compactText(job.jd ?? "", 3200),
      profile: job.profile
        ? {
            mission: this.compactText(job.profile.mission ?? "", 600),
            mustHaveSkills: this.compactJdArray(job.profile.mustHaveSkills),
            niceToHaveSkills: this.compactJdArray(job.profile.niceToHaveSkills),
            keyProjectExperience: this.compactJdArray(job.profile.keyProjectExperience),
            knockoutRules: this.compactJdArray(job.profile.knockoutRules),
            flexibleRules: this.compactJdArray(job.profile.flexibleRules),
            screeningQuestions: this.compactJdArray(job.profile.screeningQuestions),
            interviewDimensions: this.compactJdArray(job.profile.interviewDimensions),
            targetCompanies: this.compactJdArray(job.profile.targetCompanies),
            targetTitles: this.compactJdArray(job.profile.targetTitles),
            targetLevels: this.compactJdArray(job.profile.targetLevels)
          }
        : null
    };
  }

  private compactJdArray(value?: string[], maxItems = 12, maxLength = 80) {
    return (value ?? []).map((item) => this.compactText(item, maxLength)).filter(Boolean).slice(0, maxItems);
  }

  async generateResumeEvaluation(dto: ResumeEvaluationDto, userId?: string) {
    if (dto.mode === "async") {
      return this.queueResumeEvaluation(dto, userId);
    }

    const candidate = await this.prisma.candidate.findUnique({
      where: { id: dto.candidateId },
      include: { currentCompany: true, evaluations: { orderBy: { createdAt: "desc" }, take: 3 } }
    });
    if (!candidate) throw new NotFoundException("Candidate not found");

    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      include: { profile: true, jdVersions: { orderBy: { versionNo: "desc" }, take: 1 } }
    });
    if (!job) throw new NotFoundException("Job not found");

    const application =
      dto.applicationId
        ? await this.prisma.application.findUnique({ where: { id: dto.applicationId } })
        : await this.prisma.application.upsert({
            where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
            update: {},
            create: {
              candidateId: candidate.id,
              jobId: job.id,
              source: candidate.sourceChannel,
              ownerId: candidate.sourceOwnerId,
              stage: ApplicationStage.NEW
            }
          });
    if (!application) throw new NotFoundException("Application not found");

    const inputSnapshot = buildResumeEvaluationInput({ candidate, job, application });
    const inputMetrics = getResumeEvaluationInputMetrics(inputSnapshot);

    await this.prisma.application.update({
      where: { id: application.id },
      data: { nextAction: AI_EVALUATION_RUNNING }
    });

    const task = await this.createTask(AiTaskType.RESUME_EVALUATION, inputSnapshot, userId);
    this.logger.log(
      `AI resume evaluation started task=${task.id} candidate=${candidate.id} job=${job.id} inputChars=${inputMetrics.totalChars} resumeChars=${inputMetrics.resumeChars} jdChars=${inputMetrics.jdChars}`
    );

    try {
      let response;
      let result: ResumeEvaluationResult;
      try {
        response = await this.aiProvider.completeJson(this.resumeEvaluationMessages(inputSnapshot), {
          temperature: 0,
          maxCompletionTokens: 1800
        });
        result = this.parseResumeEvaluationResult(response.data);
      } catch (error) {
        this.logger.warn(`AI resume evaluation output needs retry task=${task.id}: ${error instanceof Error ? error.message : String(error)}`);
        response = await this.aiProvider.completeJson(
          this.resumeEvaluationMessages(inputSnapshot, "上一轮输出不是系统要求的JSON结构。请只输出合法JSON，并严格使用 match_score、level、recommendation、score_breakdown、summary、reasons、risks、questions_to_confirm、evidence、missing_information、suggested_next_step 字段。"),
          { temperature: 0, maxCompletionTokens: 2200 }
        );
        result = this.parseResumeEvaluationResult(response.data);
      }
      result = this.compactResumeEvaluationResult(result);
      await this.completeTask(task.id, result, response.usage);

      const evaluation = await this.prisma.candidateEvaluation.create({
        data: this.mapEvaluationData(candidate.id, job.id, application.id, task.id, result, userId)
      });

      await this.prisma.application.update({
        where: { id: application.id },
        data: {
          matchScore: result.match_score,
          recommendation: result.recommendation,
          stage: this.stageForRecommendation(result),
          nextAction: AI_EVALUATION_COMPLETED
        }
      });

      if (result.level === "green") {
        await this.prisma.candidate.update({
          where: { id: candidate.id },
          data: { status: "IN_PROCESS" }
        });
        this.generateInitialInterviewKitInBackground(application.id, userId);
      }

      return {
        evaluation_id: evaluation.id,
        status: "completed",
        result,
        interview_kit_status: result.level === "green" ? "queued" : "not_required"
      };
    } catch (error) {
      await this.failTask(task.id, error);
      await this.markApplicationEvaluationFailed(application.id);
      throw error;
    }
  }

  async overrideResumeEvaluation(id: string, dto: OverrideEvaluationDto, userId?: string) {
    return this.prisma.candidateEvaluation.update({
      where: { id },
      data: {
        manualDecision: dto.manualDecision,
        manualReason: dto.manualReason,
        createdBy: userId
      }
    });
  }

  private async queueResumeEvaluation(dto: ResumeEvaluationDto, userId?: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id: dto.candidateId },
      select: { id: true, sourceChannel: true, sourceOwnerId: true }
    });
    if (!candidate) throw new NotFoundException("Candidate not found");

    const job = await this.prisma.job.findUnique({ where: { id: dto.jobId }, select: { id: true } });
    if (!job) throw new NotFoundException("Job not found");

    const application = await this.prisma.application.upsert({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
      update: { nextAction: AI_EVALUATION_RUNNING },
      create: {
        candidateId: candidate.id,
        jobId: job.id,
        source: candidate.sourceChannel,
        ownerId: candidate.sourceOwnerId,
        stage: ApplicationStage.NEW,
        nextAction: AI_EVALUATION_RUNNING
      }
    });

    this.logger.log(`AI resume evaluation queued candidate=${candidate.id} job=${job.id} application=${application.id}`);
    void this.generateResumeEvaluation({ ...dto, applicationId: application.id, mode: "sync" }, userId).catch((error) => {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      this.logger.error(`Async resume evaluation failed for candidate ${dto.candidateId} and job ${dto.jobId}: ${message}`);
    });

    return {
      status: "queued",
      candidate_id: candidate.id,
      job_id: job.id,
      application_id: application.id
    };
  }

  async generateInterviewKit(applicationId: string, stage: string, userId?: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: true,
        job: { include: { profile: true } },
        evaluations: { orderBy: { createdAt: "desc" }, take: 1 },
        interviews: { include: { feedback: true }, orderBy: { createdAt: "desc" } }
      }
    });
    if (!application) throw new NotFoundException("Application not found");

    const inputSnapshot = {
      stage,
      candidate: application.candidate,
      job: application.job,
      job_profile: application.job.profile,
      resume_evaluation: application.evaluations[0],
      previous_interview_feedback: application.interviews.map((interview) => interview.feedback).filter(Boolean)
    };
    const task = await this.createTask(AiTaskType.INTERVIEW_KIT, inputSnapshot, userId);

    try {
      let response;
      let result: InterviewKitResult;
      try {
        response = await this.aiProvider.completeJson(this.interviewKitMessages(inputSnapshot, stage), {
          temperature: 0,
          maxCompletionTokens: 1800
        });
        result = this.parseInterviewKitResult(response.data, stage);
      } catch (error) {
        this.logger.warn(`AI interview kit output needs retry task=${task.id}: ${error instanceof Error ? error.message : String(error)}`);
        response = await this.aiProvider.completeJson(
          this.interviewKitMessages(
            inputSnapshot,
            stage,
            "上一轮输出不是系统要求的JSON结构。请只输出合法JSON，并严格使用 stage、goal、focus_areas、must_ask_questions、resume_based_questions、case_questions、good_signals、bad_signals、pass_criteria、red_flags 字段。问题对象只能使用 question、evaluation_points、purpose。"
          ),
          { temperature: 0, maxCompletionTokens: 1800 }
        );
        result = this.parseInterviewKitResult(response.data, stage);
      }
      await this.completeTask(task.id, result, response.usage);

      const kit = await this.prisma.interviewKit.create({
        data: {
          applicationId,
          candidateId: application.candidateId,
          jobId: application.jobId,
          stage: result.stage,
          aiTaskId: task.id,
          goal: result.goal,
          focusAreas: result.focus_areas,
          mustAskQuestions: result.must_ask_questions as Prisma.InputJsonValue,
          resumeBasedQuestions: result.resume_based_questions as Prisma.InputJsonValue,
          caseQuestions: result.case_questions as Prisma.InputJsonValue,
          goodSignals: result.good_signals,
          badSignals: result.bad_signals,
          passCriteria: result.pass_criteria,
          redFlags: result.red_flags,
          createdBy: userId
        }
      });

      return {
        interview_kit_id: kit.id,
        status: "completed",
        result
      };
    } catch (error) {
      await this.failTask(task.id, error);
      throw error;
    }
  }

  async generateStageHandoff(params: {
    applicationId: string;
    fromStage: string;
    toStage: string;
    createdBy?: string;
  }) {
    const application = await this.prisma.application.findUnique({
      where: { id: params.applicationId },
      include: {
        candidate: true,
        job: { include: { profile: true } },
        evaluations: { orderBy: { createdAt: "desc" }, take: 1 },
        interviews: { include: { feedback: true }, orderBy: { createdAt: "desc" } }
      }
    });
    if (!application) throw new NotFoundException("Application not found");

    const inputSnapshot = {
      from_stage: params.fromStage,
      to_stage: params.toStage,
      candidate: application.candidate,
      job: application.job,
      latest_resume_evaluation: application.evaluations[0],
      previous_interview_feedback: application.interviews.map((interview) => interview.feedback).filter(Boolean)
    };
    const task = await this.createTask(AiTaskType.STAGE_HANDOFF, inputSnapshot, params.createdBy);

    try {
      const response = await this.aiProvider.completeJson([
        { role: "system", content: `${jsonOnlySystemPrompt}\n${stageHandoffPrompt}` },
        { role: "user", content: JSON.stringify(inputSnapshot) }
      ]);
      const result = stageHandoffResultSchema.parse(response.data);
      await this.completeTask(task.id, result, response.usage);

      const packet = await this.prisma.stageHandoffPacket.create({
        data: {
          applicationId: params.applicationId,
          fromStage: params.fromStage,
          toStage: params.toStage,
          candidateSummary: result.candidate_summary,
          whyAdvance: result.why_advance,
          remainingRisks: result.remaining_risks,
          nextInterviewFocus: result.next_interview_focus,
          previousFeedbackSummary: result.previous_feedback_summary,
          recommendedQuestions: result.recommended_questions as Prisma.InputJsonValue,
          createdBy: params.createdBy
        }
      });

      return {
        stage_handoff_packet_id: packet.id,
        status: "completed",
        result
      };
    } catch (error) {
      await this.failTask(task.id, error);
      throw error;
    }
  }

  private async saveJdVersion(
    jobId: string,
    result: JdAssistantResult,
    aiTaskId: string,
    userId?: string,
    promptSnapshot?: unknown
  ) {
    const versionNo = (await this.prisma.jdVersion.count({ where: { jobId } })) + 1;
    const jdContent = toExternalJdText(result);
    const profile = result.internal_job_profile;
    const jdVersion = await this.prisma.jdVersion.create({
      data: {
        jobId,
        aiTaskId,
        versionNo,
        sourceType: "ai_assisted",
        jdContent,
        jobProfileSnapshot: profile as Prisma.InputJsonValue,
        promptSnapshot: promptSnapshot as Prisma.InputJsonValue,
        createdBy: userId
      }
    });

    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        title: result.job_title,
        jd: jdContent,
        profile: {
          upsert: {
            update: this.mapProfile(profile),
            create: { ...this.mapProfile(profile), createdBy: userId }
          }
        }
      }
    });

    return jdVersion;
  }

  private mapProfile(profile: JdAssistantResult["internal_job_profile"]) {
    return {
      mission: profile.mission,
      mustHaveSkills: profile.must_have_skills,
      niceToHaveSkills: profile.nice_to_have_skills,
      keyProjectExperience: profile.key_project_experience,
      knockoutRules: profile.knockout_rules,
      flexibleRules: profile.flexible_rules,
      screeningQuestions: profile.screening_questions,
      interviewDimensions: profile.interview_dimensions
    };
  }

  private mapEvaluationData(
    candidateId: string,
    jobId: string,
    applicationId: string,
    aiTaskId: string,
    result: ResumeEvaluationResult,
    userId?: string
  ): Prisma.CandidateEvaluationUncheckedCreateInput {
    return {
      candidateId,
      jobId,
      applicationId,
      aiTaskId,
      matchScore: result.match_score,
      level: result.level,
      recommendation: result.recommendation,
      summary: result.summary,
      scoreBreakdown: result.score_breakdown as Prisma.InputJsonValue,
      reasons: result.reasons,
      risks: result.risks,
      questionsToConfirm: result.questions_to_confirm,
      evidence: result.evidence as Prisma.InputJsonValue,
      missingInformation: result.missing_information,
      suggestedNextStep: result.suggested_next_step,
      createdBy: userId
    };
  }

  private parseResumeEvaluationResult(raw: unknown): ResumeEvaluationResult {
    const parsed = resumeEvaluationResultSchema.safeParse(normalizeResumeEvaluationPayload(raw));
    if (!parsed.success) {
      throw new BadGatewayException(`AI resume evaluation output schema mismatch: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`);
    }
    return parsed.data;
  }

  private resumeEvaluationMessages(inputSnapshot: unknown, extraInstruction?: string) {
    return [
      { role: "system" as const, content: `${jsonOnlySystemPrompt}\n${resumeEvaluationPrompt}` },
      {
        role: "user" as const,
        content: JSON.stringify({
          ...(extraInstruction ? { correction_instruction: extraInstruction } : {}),
          output_contract: {
            match_score: "0-100 number",
            level: "green | yellow | red | gray",
            recommendation:
              "advance_to_hr_screen | send_to_hiring_manager_review | reject_for_current_job | add_to_talent_pool | need_more_information",
            score_breakdown:
              "object with skill_match, project_match, business_match, level_match, stability, salary_city_match; each has score, max_score, reason"
          },
          input: inputSnapshot
        })
      }
    ];
  }

  private interviewKitMessages(inputSnapshot: unknown, stage: string, extraInstruction?: string) {
    return [
      { role: "system" as const, content: `${jsonOnlySystemPrompt}\n${interviewKitPrompt}` },
      {
        role: "user" as const,
        content: JSON.stringify({
          ...(extraInstruction ? { correction_instruction: extraInstruction } : {}),
          output_contract: {
            stage,
            goal: "本轮面试目标，80字以内",
            focus_areas: "string[]，最多8条",
            must_ask_questions: "array of { question, evaluation_points, purpose }，最多8题",
            resume_based_questions: "array of { question, evaluation_points, purpose }，最多8题",
            case_questions: "array of { question, evaluation_points, purpose }，最多5题",
            good_signals: "string[]，最多8条",
            bad_signals: "string[]，最多8条",
            pass_criteria: "string[]，最多8条",
            red_flags: "string[]，最多8条"
          },
          input: inputSnapshot
        })
      }
    ];
  }

  private parseInterviewKitResult(raw: unknown, requestedStage: string): InterviewKitResult {
    const parsed = interviewKitResultSchema.safeParse(normalizeInterviewKitPayload(raw, requestedStage));
    if (!parsed.success) {
      throw new BadGatewayException(`AI interview kit output schema mismatch: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`);
    }
    return parsed.data;
  }

  private parseResumeResult(raw: unknown, resumeText: string): ResumeParseResult {
    const parsed = resumeParseResultSchema.safeParse(normalizeResumeParsePayload(raw, resumeText));
    if (!parsed.success) {
      throw new BadGatewayException(`AI resume parse output schema mismatch: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`);
    }

    return {
      ...parsed.data,
      resumeText: parsed.data.resumeText || resumeText,
      tags: parsed.data.tags.map((tag) => this.cleanResumeParseText(tag, 40)).filter(Boolean).slice(0, 8)
    };
  }

  private mergeResumeParseResults(aiResult: ResumeParseResult, localResult: ResumeParseResult, resumeText: string): ResumeParseResult {
    return {
      name: this.pickResumeText(aiResult.name, localResult.name, 30),
      phone: localResult.phone || this.pickResumeText(aiResult.phone, "", 30),
      email: localResult.email || this.pickResumeText(aiResult.email, "", 80),
      wechat: this.pickResumeText(aiResult.wechat, localResult.wechat, 80),
      currentCompanyName: this.pickResumeText(aiResult.currentCompanyName, localResult.currentCompanyName, 80),
      currentTitle: this.pickResumeText(aiResult.currentTitle, localResult.currentTitle, 60),
      currentLevel: this.pickResumeText(aiResult.currentLevel, localResult.currentLevel, 40),
      city: this.pickResumeText(aiResult.city, localResult.city, 40),
      yearsOfExperience: aiResult.yearsOfExperience ?? localResult.yearsOfExperience ?? null,
      educationSummary: this.pickResumeText(aiResult.educationSummary, localResult.educationSummary, 120),
      expectedSalary: this.pickResumeText(aiResult.expectedSalary, localResult.expectedSalary, 60),
      currentSalary: this.pickResumeText(aiResult.currentSalary, localResult.currentSalary, 60),
      availability: this.pickResumeText(aiResult.availability, localResult.availability, 60),
      jobIntention: this.pickResumeText(aiResult.jobIntention, localResult.jobIntention, 100),
      sourceChannel: this.pickResumeText(aiResult.sourceChannel, localResult.sourceChannel, 40),
      tags: this.mergeResumeTags(aiResult.tags, localResult.tags),
      aiSummary: this.pickResumeText(aiResult.aiSummary, localResult.aiSummary, 500),
      resumeText: this.stripOpaqueResumeTokens(resumeText)
    };
  }

  private mergeResumeTags(aiTags: string[], localTags: string[]) {
    const tags = new Set<string>();
    for (const tag of [...aiTags, ...localTags]) {
      const cleaned = this.cleanResumeParseText(tag, 40);
      if (cleaned) tags.add(cleaned);
    }
    return Array.from(tags).slice(0, 8);
  }

  private pickResumeText(primary: string | undefined, fallback: string | undefined, maxLength: number) {
    return this.cleanResumeParseText(primary, maxLength) || this.cleanResumeParseText(fallback, maxLength);
  }

  private cleanResumeParseText(value: string | undefined, maxLength: number) {
    const cleaned = this.stripOpaqueResumeTokens(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned || this.isResumeNoiseText(cleaned)) return "";
    return cleaned.slice(0, maxLength).trim();
  }

  private stripOpaqueResumeTokens(value: string) {
    return value.replace(/\b[A-Za-z0-9]{24,}\b/g, (token) => (this.isOpaqueResumeToken(token) ? "" : token));
  }

  private isResumeNoiseText(value: string) {
    const compact = value.replace(/[\s:：,，;；|｜._-]/g, "");
    if (!compact) return true;
    if (this.isOpaqueResumeToken(compact)) return true;
    const asciiChars = compact.match(/[A-Za-z0-9]/g)?.length ?? 0;
    const chineseChars = compact.match(/[\u4e00-\u9fa5]/g)?.length ?? 0;
    return compact.length >= 24 && chineseChars === 0 && asciiChars / compact.length > 0.85;
  }

  private isOpaqueResumeToken(token: string) {
    if (token.length < 24) return false;
    const hasDigit = /\d/.test(token);
    const hasLower = /[a-z]/.test(token);
    const hasUpper = /[A-Z]/.test(token);
    const isHexLike = /^[a-f0-9]{24,}$/i.test(token);
    return isHexLike || (hasDigit && hasLower && hasUpper);
  }

  private compactResumeParseText(value: string, maxLength: number) {
    const text = this.stripOpaqueResumeTokens(value).replace(/\n{3,}/g, "\n\n").trim();
    if (text.length <= maxLength) return text;
    const marker = `\n\n[中间内容已省略，原文共${text.length}字]\n\n`;
    const headLength = Math.max(0, Math.floor((maxLength - marker.length) * 0.75));
    const tailLength = Math.max(0, maxLength - marker.length - headLength);
    return `${text.slice(0, headLength)}${marker}${text.slice(-tailLength)}`;
  }

  private compactResumeEvaluationResult(result: ResumeEvaluationResult): ResumeEvaluationResult {
    return {
      ...result,
      summary: this.compactText(result.summary, 160),
      reasons: result.reasons.map((item) => this.compactText(item, 120)).filter(Boolean).slice(0, 3),
      risks: result.risks.map((item) => this.compactText(item, 120)).filter(Boolean).slice(0, 3),
      questions_to_confirm: result.questions_to_confirm
        .map((item) => this.compactText(item, 120))
        .filter(Boolean)
        .slice(0, 3),
      evidence: result.evidence
        .map((item) => ({ ...item, text: this.compactText(item.text, 120) }))
        .filter((item) => item.text)
        .slice(0, 3),
      missing_information: result.missing_information.map((item) => this.compactText(item, 80)).filter(Boolean).slice(0, 4),
      suggested_next_step: this.compactText(result.suggested_next_step, 120)
    };
  }

  private compactText(value: string | undefined, maxLength: number) {
    const text = (value ?? "").replace(/\s+/g, " ").trim();
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
  }

  private stageForRecommendation(result: ResumeEvaluationResult): ApplicationStage {
    if (result.level === "green") return ApplicationStage.HR_SCREEN;
    if (result.level === "yellow") return ApplicationStage.MANAGER_REVIEW;
    if (result.level === "red") return ApplicationStage.TALENT_POOL;
    return ApplicationStage.NEW;
  }

  private async tryGenerateInitialInterviewKit(applicationId: string, userId?: string) {
    try {
      await this.generateInterviewKit(applicationId, "hr_screen", userId);
    } catch {
      // The evaluation is still useful if follow-up kit generation fails; the failed AI task keeps the error.
    }
  }

  private generateInitialInterviewKitInBackground(applicationId: string, userId?: string) {
    void this.tryGenerateInitialInterviewKit(applicationId, userId);
  }

  private async markApplicationEvaluationFailed(applicationId: string) {
    try {
      await this.prisma.application.update({
        where: { id: applicationId },
        data: { nextAction: AI_EVALUATION_FAILED }
      });
    } catch {
      // The failed AiTask keeps the detailed error. Avoid masking the original evaluation failure.
    }
  }

  private createTask(taskType: AiTaskType, inputSnapshot: unknown, createdBy?: string) {
    return this.prisma.aiTask.create({
      data: {
        taskType,
        status: AiTaskStatus.RUNNING,
        modelName: this.aiProvider.model,
        inputSnapshot: this.toJsonValue(inputSnapshot),
        createdBy
      }
    });
  }

  private completeTask(id: string, outputSnapshot: unknown, usage?: { prompt_tokens?: number; completion_tokens?: number }) {
    return this.prisma.aiTask.update({
      where: { id },
      data: {
        status: AiTaskStatus.COMPLETED,
        outputSnapshot: this.toJsonValue(outputSnapshot),
        tokenUsagePrompt: usage?.prompt_tokens,
        tokenUsageCompletion: usage?.completion_tokens,
        completedAt: new Date()
      }
    });
  }

  private failTask(id: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return this.prisma.aiTask.update({
      where: { id },
      data: {
        status: AiTaskStatus.FAILED,
        errorMessage: message,
        completedAt: new Date()
      }
    });
  }

  private toJsonValue(value: unknown) {
    const json = JSON.stringify(value ?? null, (_key, item) => (typeof item === "bigint" ? item.toString() : item));
    return JSON.parse(json ?? "null") as Prisma.InputJsonValue;
  }
}
