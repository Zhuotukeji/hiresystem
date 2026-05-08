import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsOptional, IsString } from "class-validator";
import { candidateStatuses } from "@hiresystem/shared";
import { PartialType } from "@nestjs/mapped-types";

export class CreateCandidateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  wechat?: string;

  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  maimaiUrl?: string;

  @IsOptional()
  @IsString()
  bossUrl?: string;

  @IsOptional()
  @IsString()
  githubUrl?: string;

  @IsOptional()
  @IsString()
  currentCompanyId?: string;

  @IsOptional()
  @IsString()
  currentCompanyName?: string;

  @IsOptional()
  @IsString()
  currentTitle?: string;

  @IsOptional()
  @IsString()
  currentLevel?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearsOfExperience?: number;

  @IsOptional()
  @IsString()
  educationSummary?: string;

  @IsOptional()
  @IsString()
  expectedSalary?: string;

  @IsOptional()
  @IsString()
  currentSalary?: string;

  @IsOptional()
  @IsString()
  availability?: string;

  @IsOptional()
  @IsString()
  jobIntention?: string;

  @IsOptional()
  @IsString()
  sourceChannel?: string;

  @IsOptional()
  @IsString()
  sourceOwnerId?: string;

  @IsOptional()
  @IsString()
  resumeFileUrl?: string;

  @IsOptional()
  @IsString()
  resumeText?: string;

  @IsOptional()
  @IsString()
  aiSummary?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(candidateStatuses)
  status?: string;

  @IsOptional()
  @IsString()
  privacyConsentStatus?: string;
}

export class UpdateCandidateDto extends PartialType(CreateCandidateDto) {}
