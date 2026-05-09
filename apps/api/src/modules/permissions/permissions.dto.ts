import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, ValidateNested } from "class-validator";
import { managedPermissionActions, managedPermissionResources, managedUserRoles } from "./permissions.constants";

export class RolePermissionItemDto {
  @IsIn(managedUserRoles)
  role!: string;

  @IsIn(managedPermissionResources)
  resource!: string;

  @IsIn(managedPermissionActions)
  action!: string;

  @IsBoolean()
  allowed!: boolean;
}

export class UpdateRolePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionItemDto)
  permissions!: RolePermissionItemDto[];
}
