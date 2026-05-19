import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateInterviewDto, SubmitFeedbackDto } from "./interviews.dto";

@Injectable()
export class InterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInterviewDto) {
    if (!dto.interviewerId) {
      throw new BadRequestException("请选择面试官");
    }

    const application = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
      include: { candidate: true, job: true }
    });
    if (!application) throw new NotFoundException("Application not found");

    const interviewer = await this.prisma.user.findFirst({
      where: { id: dto.interviewerId, isActive: true },
      select: { id: true }
    });
    if (!interviewer) {
      throw new BadRequestException("面试官账号不存在或已禁用");
    }

    return this.prisma.interview.create({
      data: {
        applicationId: application.id,
        candidateId: application.candidateId,
        jobId: application.jobId,
        interviewRound: dto.interviewRound,
        interviewerId: dto.interviewerId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined
      }
    });
  }

  async myTasks(userId: string) {
    const interviews = await this.prisma.interview.findMany({
      where: {
        interviewerId: userId,
        status: "SCHEDULED"
      },
      include: {
        candidate: { select: { id: true, name: true, currentCompanyName: true, currentTitle: true } },
        job: { select: { id: true, title: true, department: true } },
        feedback: { select: { id: true } }
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50
    });

    return interviews
      .sort((left, right) => {
        const leftTime = left.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const rightTime = right.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (leftTime !== rightTime) return leftTime - rightTime;
        return right.createdAt.getTime() - left.createdAt.getTime();
      })
      .slice(0, 20)
      .map((interview) => ({
        interviewId: interview.id,
        candidateId: interview.candidateId,
        candidateName: interview.candidate.name,
        candidateTitle: interview.candidate.currentTitle,
        candidateCompany: interview.candidate.currentCompanyName,
        jobId: interview.jobId,
        jobTitle: interview.job.title,
        jobDepartment: interview.job.department,
        interviewRound: interview.interviewRound,
        status: interview.status,
        scheduledAt: interview.scheduledAt,
        createdAt: interview.createdAt,
        hasFeedback: Boolean(interview.feedback)
      }));
  }

  interviewers() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: "asc" }, { name: "asc" }]
    });
  }

  async workspace(id: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      include: {
        interviewer: { select: { id: true, name: true, email: true } },
        candidate: true,
        job: { include: { profile: true } },
        application: {
          include: {
            evaluations: { orderBy: { createdAt: "desc" }, take: 1 },
            interviewKits: { orderBy: { createdAt: "desc" } },
            handoffPackets: { orderBy: { createdAt: "desc" }, take: 1 },
            interviews: {
              where: { id: { not: id } },
              include: { feedback: true },
              orderBy: { createdAt: "desc" }
            }
          }
        },
        feedback: true
      }
    });
    if (!interview) throw new NotFoundException("Interview not found");

    const matchingKit =
      interview.application.interviewKits.find((kit) => kit.stage === interview.interviewRound) ??
      interview.application.interviewKits[0] ??
      null;

    return {
      interview,
      candidate: interview.candidate,
      job: interview.job,
      latestEvaluation: interview.application.evaluations[0] ?? null,
      interviewKit: matchingKit,
      latestHandoff: interview.application.handoffPackets[0] ?? null,
      previousFeedback: interview.application.interviews.map((item) => item.feedback).filter(Boolean)
    };
  }

  async submitFeedback(id: string, dto: SubmitFeedbackDto, userId?: string) {
    if (!dto.evidence?.trim()) {
      throw new BadRequestException("Feedback evidence is required");
    }

    const interview = await this.prisma.interview.findUnique({ where: { id } });
    if (!interview) throw new NotFoundException("Interview not found");

    const feedback = await this.prisma.interviewFeedback.upsert({
      where: { interviewId: id },
      update: {
        scores: dto.scores as Prisma.InputJsonValue,
        conclusion: dto.conclusion,
        strengths: dto.strengths ?? [],
        weaknesses: dto.weaknesses ?? [],
        evidence: dto.evidence,
        interviewerId: userId ?? interview.interviewerId
      },
      create: {
        interviewId: id,
        interviewerId: userId ?? interview.interviewerId,
        scores: dto.scores as Prisma.InputJsonValue,
        conclusion: dto.conclusion,
        strengths: dto.strengths ?? [],
        weaknesses: dto.weaknesses ?? [],
        evidence: dto.evidence
      }
    });

    await this.prisma.interview.update({
      where: { id },
      data: { status: "COMPLETED" }
    });

    return feedback;
  }
}
