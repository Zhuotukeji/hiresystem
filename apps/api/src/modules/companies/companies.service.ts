import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCompanyDto, UpdateCompanyDto } from "./companies.dto";

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: Record<string, string>) {
    const keyword = query.keyword?.trim();
    const where: Prisma.TargetCompanyWhereInput = keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: "insensitive" } },
            { industry: { contains: keyword, mode: "insensitive" } },
            { businessTags: { has: keyword } },
            { techTags: { has: keyword } }
          ]
        }
      : {};
    if (query.companyType) where.companyType = query.companyType;
    if (query.quality) where.talentQualityLevel = query.quality;

    const items = await this.prisma.targetCompany.findMany({
      where,
      include: {
        _count: {
          select: { candidates: true }
        }
      },
      orderBy: [{ sourcingPriority: "asc" }, { updatedAt: "desc" }]
    });
    return { items, total: items.length };
  }

  async findOne(id: string) {
    const company = await this.prisma.targetCompany.findUnique({
      where: { id },
      include: {
        candidates: {
          include: { applications: { include: { job: true } } },
          orderBy: { updatedAt: "desc" }
        }
      }
    });
    if (!company) throw new NotFoundException("Target company not found");
    return company;
  }

  create(dto: CreateCompanyDto) {
    return this.prisma.targetCompany.create({ data: this.toData(dto) as Prisma.TargetCompanyUncheckedCreateInput });
  }

  update(id: string, dto: UpdateCompanyDto) {
    return this.prisma.targetCompany.update({
      where: { id },
      data: this.toData(dto) as Prisma.TargetCompanyUncheckedUpdateInput
    });
  }

  remove(id: string) {
    return this.prisma.targetCompany.delete({ where: { id } });
  }

  private toData(dto: CreateCompanyDto | UpdateCompanyDto) {
    return {
      ...dto,
      knownDepartments: dto.knownDepartments as Prisma.InputJsonValue,
      knownLevels: dto.knownLevels as Prisma.InputJsonValue
    };
  }
}
