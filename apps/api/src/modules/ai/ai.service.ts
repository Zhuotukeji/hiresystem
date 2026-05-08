import { Injectable, NotFoundException } from "@nestjs/common";
import { AiTaskStatus, AiTaskType, ApplicationStage, Prisma } from "@prisma/client";
import {
  InterviewKitResult,
  JdAssistantResult,
  ResumeEvaluationResult,
  StageHandoffResult,
  interviewKitResultSchema,
  jdAssistantResultSchema,
  resumeEvaluationResultSchema,
  stageHandoffResultSchema,
  toExternalJdText
} from "@hiresystem/shared";
import { PrismaService } from "../prisma/prisma.service";
import { CreateJdSessionDto, OverrideEvaluationDto, ResumeEvaluationDto, SendJdMessageDto } from "./ai.dto";
import { AiProvider } from "./ai.provider";
import {
  interviewKitPrompt,
  jdAssistantPrompt,
  jsonOnlySystemPrompt,
  resumeEvaluationPrompt,
  stageHandoffPrompt
} from "./ai.prompts";

@Injectable()
export class AiService {
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

  async continueJdChat(sessionId: string, dto: SendJdMessageDto, userId?: string) {
    const session = await this.prisma.jdChatSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: "asc" } } }
    });
    if (!session) throw new NotFoundException("JD chat session not found");

    await this.prisma.jdChatMessage.create({
      data: { sessionId, role: "user", content: dto.content }
    });

    const inputSnapshot = {
      sessionId,
      userMessage: dto.content,
      history: session.messages.map((message) => ({ role: message.role, content: message.content }))
    };
    const task = await this.createTask(AiTaskType.JD_CHAT, inputSnapshot, userId);

    try {
      const response = await this.aiProvider.completeJson([
        { role: "system", content: `${jsonOnlySystemPrompt}\n${jdAssistantPrompt}` },
        {
          role: "user",
          content: JSON.stringify({
            instruction:
              "继续对话。如果信息足够，请输出完整JD JSON；如果信息不足，也输出当前可生成的JSON，并在company_pitch或mission中保持务实，不要编造业务事实。",
            history: inputSnapshot.history,
            latest_user_message: dto.content
          })
        }
      ]);
      const result = jdAssistantResultSchema.parse(response.data);

      await this.completeTask(task.id, result, response.usage);
      await this.prisma.jdChatMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content: toExternalJdText(result),
          structuredPayload: result as Prisma.InputJsonValue
        }
      });

      const jobId = dto.saveToJobId ?? session.jobId;
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

  async generateResumeEvaluation(dto: ResumeEvaluationDto, userId?: string) {
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

    const inputSnapshot = {
      candidate: {
        id: candidate.id,
        name: candidate.name,
        resume_text: candidate.resumeText,
        current_company: candidate.currentCompanyName,
        current_title: candidate.currentTitle,
        years_of_experience: candidate.yearsOfExperience,
        city: candidate.city,
        expected_salary: candidate.expectedSalary,
        tags: candidate.tags
      },
      target_company_info: candidate.currentCompany,
      job,
      job_profile: job.profile,
      historical_samples: candidate.evaluations
    };

    const task = await this.createTask(AiTaskType.RESUME_EVALUATION, inputSnapshot, userId);

    try {
      const response = await this.aiProvider.completeJson([
        { role: "system", content: `${jsonOnlySystemPrompt}\n${resumeEvaluationPrompt}` },
        { role: "user", content: JSON.stringify(inputSnapshot) }
      ]);
      const result = resumeEvaluationResultSchema.parse(response.data);
      await this.completeTask(task.id, result, response.usage);

      const evaluation = await this.prisma.candidateEvaluation.create({
        data: this.mapEvaluationData(candidate.id, job.id, application.id, task.id, result, userId)
      });

      await this.prisma.application.update({
        where: { id: application.id },
        data: {
          matchScore: result.match_score,
          recommendation: result.recommendation,
          stage: this.stageForRecommendation(result)
        }
      });

      if (result.level === "green") {
        await this.prisma.candidate.update({
          where: { id: candidate.id },
          data: { status: "IN_PROCESS" }
        });
        await this.tryGenerateInitialInterviewKit(application.id, userId);
      }

      return {
        evaluation_id: evaluation.id,
        status: "completed",
        result
      };
    } catch (error) {
      await this.failTask(task.id, error);
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
      const response = await this.aiProvider.completeJson([
        { role: "system", content: `${jsonOnlySystemPrompt}\n${interviewKitPrompt}` },
        { role: "user", content: JSON.stringify(inputSnapshot) }
      ]);
      const result = interviewKitResultSchema.parse(response.data);
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

  private createTask(taskType: AiTaskType, inputSnapshot: unknown, createdBy?: string) {
    return this.prisma.aiTask.create({
      data: {
        taskType,
        status: AiTaskStatus.RUNNING,
        modelName: this.aiProvider.model,
        inputSnapshot: inputSnapshot as Prisma.InputJsonValue,
        createdBy
      }
    });
  }

  private completeTask(id: string, outputSnapshot: unknown, usage?: { prompt_tokens?: number; completion_tokens?: number }) {
    return this.prisma.aiTask.update({
      where: { id },
      data: {
        status: AiTaskStatus.COMPLETED,
        outputSnapshot: outputSnapshot as Prisma.InputJsonValue,
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
}
