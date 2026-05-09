import { Body, Controller, Get, Put } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../common/current-user.decorator";
import { Roles } from "../../common/roles.decorator";
import { PermissionsService } from "./permissions.service";
import { UpdateRolePermissionsDto } from "./permissions.dto";

@Controller("permissions")
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.permissionsService.getCurrentUserPermissions(user.role);
  }

  @Roles("ADMIN")
  @Get("role-permissions")
  rolePermissions() {
    return this.permissionsService.getRolePermissions();
  }

  @Roles("ADMIN")
  @Put("role-permissions")
  updateRolePermissions(@Body() dto: UpdateRolePermissionsDto) {
    return this.permissionsService.updateRolePermissions(dto);
  }
}
