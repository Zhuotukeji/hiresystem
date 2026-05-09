import { BadRequestException, Injectable } from "@nestjs/common";
import { PermissionAction, PermissionResource, UserRole } from "@prisma/client";
import type { PermissionAction as SharedPermissionAction, PermissionResource as SharedPermissionResource } from "@hiresystem/shared";
import { PrismaService } from "../prisma/prisma.service";
import { managedPermissionActions, managedPermissionResources, managedUserRoles } from "./permissions.constants";
import { UpdateRolePermissionsDto } from "./permissions.dto";

type PermissionItem = {
  role: string;
  resource: SharedPermissionResource;
  action: SharedPermissionAction;
  allowed: boolean;
  locked: boolean;
};

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentUserPermissions(role: string) {
    return {
      role,
      permissions: await this.resolveRolePermissions(role),
      can: await this.resolveRolePermissionMap(role)
    };
  }

  async getRolePermissions() {
    return { permissions: await this.buildRolePermissionMatrix() };
  }

  async updateRolePermissions(dto: UpdateRolePermissionsDto) {
    const hasDisabledAdmin = dto.permissions.some((item) => item.role === UserRole.ADMIN && !item.allowed);
    if (hasDisabledAdmin) {
      throw new BadRequestException("ADMIN permissions cannot be disabled");
    }

    const editablePermissions = dto.permissions.filter((item) => item.role !== UserRole.ADMIN);
    await this.prisma.$transaction(
      editablePermissions.map((item) =>
        this.prisma.rolePermission.upsert({
          where: {
            role_resource_action: {
              role: item.role as UserRole,
              resource: item.resource as PermissionResource,
              action: item.action as PermissionAction
            }
          },
          update: { allowed: item.allowed },
          create: {
            role: item.role as UserRole,
            resource: item.resource as PermissionResource,
            action: item.action as PermissionAction,
            allowed: item.allowed
          }
        })
      )
    );

    return this.getRolePermissions();
  }

  private async resolveRolePermissionMap(role: string) {
    const permissions = await this.resolveRolePermissions(role);
    return managedPermissionResources.reduce(
      (resourceMap, resource) => ({
        ...resourceMap,
        [resource]: managedPermissionActions.reduce(
          (actionMap, action) => ({
            ...actionMap,
            [action]: permissions.some((item) => item.resource === resource && item.action === action && item.allowed)
          }),
          {} as Record<SharedPermissionAction, boolean>
        )
      }),
      {} as Record<SharedPermissionResource, Record<SharedPermissionAction, boolean>>
    );
  }

  private async resolveRolePermissions(role: string): Promise<PermissionItem[]> {
    return (await this.buildRolePermissionMatrix()).filter((item) => item.role === role);
  }

  private async buildRolePermissionMatrix(): Promise<PermissionItem[]> {
    const storedPermissions = await this.prisma.rolePermission.findMany();
    const storedByKey = new Map(
      storedPermissions.map((item) => [`${item.role}:${item.resource}:${item.action}`, item.allowed])
    );

    return managedUserRoles.flatMap((role) =>
      managedPermissionResources.flatMap((resource) =>
        managedPermissionActions.map((action) => {
          const locked = role === UserRole.ADMIN;
          const key = `${role}:${resource}:${action}`;
          return {
            role,
            resource,
            action,
            allowed: locked ? true : storedByKey.get(key) ?? false,
            locked
          };
        })
      )
    );
  }
}
