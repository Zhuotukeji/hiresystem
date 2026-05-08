import { IsArray, IsIn, IsOptional, IsString } from "class-validator";
import { interviewConclusions } from "@hiresystem/shared";

export class CreateInterviewDto {
  @IsString()
  applicationId!: string;

  @IsString()
  interviewRound!: string;

  @IsOptional()
  @IsString()
  interviewerId?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class SubmitFeedbackDto {
  scores!: unknown;

  @IsIn(interviewConclusions)
  conclusion!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  strengths?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  weaknesses?: string[];

  @IsString()
  evidence!: string;
}
