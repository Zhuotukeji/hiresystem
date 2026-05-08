import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      service: "hiresystem-api",
      time: new Date().toISOString()
    };
  }
}
