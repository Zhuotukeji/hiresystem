import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsOptional, IsString } from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export class CreateJobDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  hiringManagerId?: string;

  @IsOptional()
  @IsString()
  recruiterId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  headcount?: number;

  @IsOptional()
  @IsIn(["P0", "P1", "P2"])
  priority?: string;

  @IsOptional()
  @IsIn(["OPEN", "PAUSED", "CLOSED"])
  status?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salaryMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  salaryMax?: number;

  @IsOptional()
  @IsString()
  jd?: string;
}

export class UpdateJobDto extends PartialType(CreateJobDto) {}

export class JobProfileDto {
  @IsOptional()
  @IsString()
  mission?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mustHaveSkills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  niceToHaveSkills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetCompanies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedCompanies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetTitles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetLevels?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  targetYearsMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  targetYearsMax?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyProjectExperience?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knockoutRules?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  flexibleRules?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  screeningQuestions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interviewDimensions?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  passScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yellowScoreMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yellowScoreMax?: number;
}
