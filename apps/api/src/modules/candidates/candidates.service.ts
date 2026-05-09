import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CandidateStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCandidateDto, UpdateCandidateDto } from "./candidates.dto";

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: Record<string, string>) {
    const where: Prisma.CandidateWhereInput = {};
    const keyword = query.keyword?.trim();
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: "insensitive" } },
        { currentCompanyName: { contains: keyword, mode: "insensitive" } },
        { currentTitle: { contains: keyword, mode: "insensitive" } },
        { resumeText: { contains: keyword, mode: "insensitive" } }
      ];
    }
    if (query.status) {
      where.status = query.status as CandidateStatus;
    }
    if (query.company) {
      where.currentCompanyName = { contains: query.company, mode: "insensitive" };
    }
    if (query.city) {
      where.city = { contains: query.city, mode: "insensitive" };
    }
    if (query.tag) {
      where.tags = { has: query.tag };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.candidate.findMany({
        where,
        include: {
          currentCompany: true,
          applications: { include: { job: true }, orderBy: { updatedAt: "desc" } },
          evaluations: { orderBy: { createdAt: "desc" }, take: 1 }
        },
        orderBy: { updatedAt: "desc" },
        take: Number(query.take ?? 50),
        skip: Number(query.skip ?? 0)
      }),
      this.prisma.candidate.count({ where })
    ]);
    return { items, total };
  }

  async findOne(id: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: {
        currentCompany: true,
        applications: {
          include: { job: true, evaluations: { orderBy: { createdAt: "desc" }, take: 1 } },
          orderBy: { updatedAt: "desc" }
        },
        evaluations: { include: { job: true }, orderBy: { createdAt: "desc" } },
        interviews: { include: { job: true, feedback: true }, orderBy: { createdAt: "desc" } }
      }
    });
    if (!candidate) {
      throw new NotFoundException("Candidate not found");
    }
    return candidate;
  }

  async create(dto: CreateCandidateDto, userId?: string) {
    const duplicate = await this.findDuplicate(dto);
    if (duplicate) {
      throw new BadRequestException({ message: "Candidate may already exist", duplicate });
    }
    const { status, ...data } = dto;

    return this.prisma.candidate.create({
      data: {
        ...data,
        status: (status as CandidateStatus | undefined) ?? CandidateStatus.NEW,
        sourceOwnerId: dto.sourceOwnerId ?? userId
      }
    });
  }

  update(id: string, dto: UpdateCandidateDto) {
    const { status, ...data } = dto;
    return this.prisma.candidate.update({
      where: { id },
      data: {
        ...data,
        status: status as CandidateStatus | undefined
      }
    });
  }

  remove(id: string) {
    return this.prisma.candidate.delete({ where: { id } });
  }

  private async findDuplicate(dto: CreateCandidateDto) {
    const checks: Prisma.CandidateWhereInput[] = [];
    if (dto.phone) checks.push({ phone: dto.phone });
    if (dto.email) checks.push({ email: dto.email });
    if (dto.linkedinUrl) checks.push({ linkedinUrl: dto.linkedinUrl });
    if (dto.maimaiUrl) checks.push({ maimaiUrl: dto.maimaiUrl });
    if (dto.bossUrl) checks.push({ bossUrl: dto.bossUrl });
    if (dto.name && dto.currentCompanyName && dto.currentTitle) {
      checks.push({
        name: dto.name,
        currentCompanyName: dto.currentCompanyName,
        currentTitle: dto.currentTitle
      });
    }
    if (!checks.length) return null;
    return this.prisma.candidate.findFirst({ where: { OR: checks } });
  }
}
