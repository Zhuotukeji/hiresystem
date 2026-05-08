import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString } from "class-validator";
import { applicationStages } from "@hiresystem/shared";

export class CreateApplicationDto {
  @IsString()
  candidateId!: string;

  @IsString()
  jobId!: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsIn(applicationStages)
  stage?: string;
}

export class UpdateApplicationDto {
  @IsOptional()
  @IsIn(applicationStages)
  stage?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  matchScore?: number;

  @IsOptional()
  @IsString()
  recommendation?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  nextAction?: string;

  @IsOptional()
  @IsDateString()
  nextActionDueAt?: string;
}
