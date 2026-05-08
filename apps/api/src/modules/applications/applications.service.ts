import { Inject, Injectable, NotFoundException, forwardRef } from "@nestjs/common";
import { ApplicationStage } from "@prisma/client";
import { AiService } from "../ai/ai.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateApplicationDto, UpdateApplicationDto } from "./applications.dto";

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService
  ) {}

  async findMany(query: Record<string, string>) {
    const items = await this.prisma.application.findMany({
      where: {
        jobId: query.jobId,
        candidateId: query.candidateId,
        stage: query.stage as ApplicationStage | undefined
      },
      include: {
        candidate: true,
        job: true,
        evaluations: { orderBy: { createdAt: "desc" }, take: 1 },
        interviews: { include: { feedback: true } },
        interviewKits: { orderBy: { createdAt: "desc" }, take: 1 }
      },
      orderBy: { updatedAt: "desc" }
    });
    return { items, total: items.length };
  }

  create(dto: CreateApplicationDto) {
    return this.prisma.application.upsert({
      where: { candidateId_jobId: { candidateId: dto.candidateId, jobId: dto.jobId } },
      update: {
        source: dto.source,
        ownerId: dto.ownerId,
        stage: (dto.stage as ApplicationStage | undefined) ?? ApplicationStage.NEW
      },
      create: {
        candidateId: dto.candidateId,
        jobId: dto.jobId,
        source: dto.source,
        ownerId: dto.ownerId,
        stage: (dto.stage as ApplicationStage | undefined) ?? ApplicationStage.NEW
      }
    });
  }

  update(id: string, dto: UpdateApplicationDto) {
    const { stage, nextActionDueAt, ...data } = dto;
    return this.prisma.application.update({
      where: { id },
      data: {
        ...data,
        stage: stage as ApplicationStage | undefined,
        nextActionDueAt: nextActionDueAt ? new Date(nextActionDueAt) : undefined
      }
    });
  }

  async createStageHandoff(id: string, toStage?: string, userId?: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: { candidate: true, job: { include: { profile: true } } }
    });
    if (!application) throw new NotFoundException("Application not found");
    return this.aiService.generateStageHandoff({
      applicationId: id,
      fromStage: application.stage,
      toStage: toStage ?? this.nextStage(application.stage),
      createdBy: userId
    });
  }

  private nextStage(stage: ApplicationStage) {
    const order: ApplicationStage[] = [
      ApplicationStage.HR_SCREEN,
      ApplicationStage.FIRST_INTERVIEW,
      ApplicationStage.SECOND_INTERVIEW,
      ApplicationStage.FINAL_INTERVIEW,
      ApplicationStage.OFFER
    ];
    const index = order.indexOf(stage);
    if (index < 0) return ApplicationStage.HR_SCREEN;
    return order[Math.min(index + 1, order.length - 1)];
  }
}
