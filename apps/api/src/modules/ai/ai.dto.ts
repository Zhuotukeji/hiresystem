import { IsIn, IsOptional, IsString } from "class-validator";
import { interviewStages, recommendationActions } from "@hiresystem/shared";

export class CreateJdSessionDto {
  @IsOptional()
  @IsString()
  jobId?: string;
}

export class SendJdMessageDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  saveToJobId?: string;
}

export class ResumeEvaluationDto {
  @IsString()
  candidateId!: string;

  @IsString()
  jobId!: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsString()
  mode?: string;
}

export class ResumeParseDto {
  @IsOptional()
  @IsString()
  resumeText?: string;

  @IsOptional()
  @IsString()
  mode?: string;
}

export class OverrideEvaluationDto {
  @IsIn(recommendationActions)
  manualDecision!: string;

  @IsString()
  manualReason!: string;
}

export class GenerateInterviewKitDto {
  @IsString()
  applicationId!: string;

  @IsIn(interviewStages)
  stage!: string;

  @IsOptional()
  @IsString()
  mode?: string;
}
