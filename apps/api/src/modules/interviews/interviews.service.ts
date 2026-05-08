import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateInterviewDto, SubmitFeedbackDto } from "./interviews.dto";

@Injectable()
export class InterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInterviewDto) {
    const application = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
      include: { candidate: true, job: true }
    });
    if (!application) throw new NotFoundException("Application not found");

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
