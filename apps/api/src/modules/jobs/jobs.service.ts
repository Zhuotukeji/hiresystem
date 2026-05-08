import { Injectable, NotFoundException } from "@nestjs/common";
import { JobPriority, JobStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateJobDto, JobProfileDto, UpdateJobDto } from "./jobs.dto";

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: Record<string, string>) {
    const where: Prisma.JobWhereInput = {};
    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword, mode: "insensitive" } },
        { department: { contains: query.keyword, mode: "insensitive" } },
        { city: { contains: query.keyword, mode: "insensitive" } }
      ];
    }
    if (query.status) where.status = query.status as JobStatus;
    if (query.priority) where.priority = query.priority as JobPriority;

    const items = await this.prisma.job.findMany({
      where,
      include: {
        profile: true,
        hiringManager: { select: { id: true, name: true, email: true } },
        recruiter: { select: { id: true, name: true, email: true } },
        _count: { select: { applications: true } }
      },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }]
    });
    return { items, total: items.length };
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        profile: true,
        hiringManager: { select: { id: true, name: true, email: true } },
        recruiter: { select: { id: true, name: true, email: true } },
        applications: {
          include: {
            candidate: true,
            evaluations: { orderBy: { createdAt: "desc" }, take: 1 },
            interviews: { include: { feedback: true }, orderBy: { createdAt: "desc" } },
            interviewKits: { orderBy: { createdAt: "desc" }, take: 1 }
          },
          orderBy: { updatedAt: "desc" }
        },
        jdVersions: { orderBy: { versionNo: "desc" } }
      }
    });
    if (!job) throw new NotFoundException("Job not found");
    return job;
  }

  create(dto: CreateJobDto, userId?: string) {
    const { priority, status, ...data } = dto;
    return this.prisma.job.create({
      data: {
        ...data,
        priority: (priority as JobPriority | undefined) ?? JobPriority.P1,
        status: (status as JobStatus | undefined) ?? JobStatus.OPEN,
        recruiterId: dto.recruiterId ?? userId
      }
    });
  }

  update(id: string, dto: UpdateJobDto) {
    const { priority, status, ...data } = dto;
    return this.prisma.job.update({
      where: { id },
      data: {
        ...data,
        priority: priority as JobPriority | undefined,
        status: status as JobStatus | undefined
      }
    });
  }

  upsertProfile(jobId: string, dto: JobProfileDto, userId?: string) {
    return this.prisma.jobProfile.upsert({
      where: { jobId },
      update: dto,
      create: {
        ...dto,
        jobId,
        createdBy: userId
      }
    });
  }

  async dashboardStats() {
    const [openJobs, candidates, applicationsByStage, bossCandidates, targetCompanies, feedbackPending] =
      await this.prisma.$transaction([
        this.prisma.job.count({ where: { status: "OPEN" } }),
        this.prisma.candidate.count(),
        this.prisma.application.groupBy({ by: ["stage"], _count: true, orderBy: { stage: "asc" } }),
        this.prisma.candidate.count({ where: { sourceChannel: { contains: "boss", mode: "insensitive" } } }),
        this.prisma.targetCompany.count(),
        this.prisma.interview.count({
          where: { status: "SCHEDULED", scheduledAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        })
      ]);
    return {
      openJobs,
      candidates,
      targetCompanies,
      bossDependencyRate: candidates ? Math.round((bossCandidates / candidates) * 100) : 0,
      feedbackPending,
      applicationsByStage: applicationsByStage.map((item) => ({ stage: item.stage, count: item._count }))
    };
  }
}
