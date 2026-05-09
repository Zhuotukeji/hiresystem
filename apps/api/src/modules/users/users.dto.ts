import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { userRoles } from "@hiresystem/shared";

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(userRoles)
  role!: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(userRoles)
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}
