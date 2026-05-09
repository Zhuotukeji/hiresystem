import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiModule } from "./modules/ai/ai.module";
import { ApplicationsModule } from "./modules/applications/applications.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CandidatesModule } from "./modules/candidates/candidates.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { HealthController } from "./modules/health/health.controller";
import { InterviewsModule } from "./modules/interviews/interviews.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CandidatesModule,
    CompaniesModule,
    JobsModule,
    ApplicationsModule,
    PermissionsModule,
    AiModule,
    InterviewsModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
