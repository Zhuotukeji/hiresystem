import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/public.decorator";
import { AiProvider } from "../ai/ai.provider";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProvider
  ) {}

  @Public()
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      service: "hiresystem-api",
      version: process.env.APP_VERSION ?? "dev",
      buildTime: process.env.APP_BUILD_TIME ?? "unknown",
      time: new Date().toISOString(),
      ai: this.aiProvider.configStatus,
      routes: {
        resumeParse: "/api/ai/resume-parse",
        resumeParseText: "/api/ai/resume-parse-text",
        resumeEvaluations: "/api/ai/resume-evaluations",
        interviewKits: "/api/ai/interview-kits"
      },
      features: {
        errorDiagnostics: true,
        interviewKitFallback: true,
        requestIdHeader: true
      }
    };
  }
}
