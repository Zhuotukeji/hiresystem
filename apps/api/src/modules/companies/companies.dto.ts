import { IsArray, IsOptional, IsString } from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export class CreateCompanyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  companyType?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  financingStage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  businessTags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techTags?: string[];

  @IsOptional()
  @IsString()
  talentQualityLevel?: string;

  @IsOptional()
  @IsString()
  sourcingPriority?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetRoles?: string[];

  @IsOptional()
  knownDepartments?: unknown;

  @IsOptional()
  knownLevels?: unknown;

  @IsOptional()
  @IsString()
  compensationLevel?: string;

  @IsOptional()
  @IsString()
  riskNotes?: string;

  @IsOptional()
  @IsString()
  relationshipOwnerId?: string;
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}
