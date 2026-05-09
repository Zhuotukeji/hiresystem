import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionAction, PermissionResource, UserRole } from "@prisma/client";
import { PrismaService } from "../modules/prisma/prisma.service";
import { PERMISSION_KEY, RequiredPermission } from "./permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<RequiredPermission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const role = request.user?.role as UserRole | undefined;
    if (role === UserRole.ADMIN) {
      return true;
    }
    if (!role) {
      throw new ForbiddenException("Insufficient permissions");
    }

    const permission = await this.prisma.rolePermission.findUnique({
      where: {
        role_resource_action: {
          role,
          resource: requiredPermission.resource as PermissionResource,
          action: requiredPermission.action as PermissionAction
        }
      }
    });
    if (permission?.allowed) {
      return true;
    }

    throw new ForbiddenException("Insufficient permissions");
  }
}
