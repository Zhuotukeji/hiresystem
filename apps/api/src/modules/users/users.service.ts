import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { User, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto, UpdateUserDto } from "./users.dto";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findMany() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: userSelect
    });
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role as UserRole
      },
      select: userSelect
    });
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const target = await this.getExistingUser(id);
    await this.assertAdminStateChangeAllowed(target, actorId, dto);

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        role: dto.role as UserRole | undefined,
        isActive: dto.isActive
      },
      select: userSelect
    });
  }

  async resetPassword(id: string, password: string) {
    await this.getExistingUser(id);
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: userSelect
    });
  }

  async disable(id: string, actorId: string) {
    const target = await this.getExistingUser(id);
    await this.assertAdminStateChangeAllowed(target, actorId, { isActive: false });
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: userSelect
    });
  }

  private async getExistingUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  private async assertAdminStateChangeAllowed(
    target: User,
    actorId: string,
    dto: UpdateUserDto
  ) {
    if (target.id === actorId && dto.isActive === false) {
      throw new BadRequestException("Cannot disable your own account");
    }
    if (target.id === actorId && dto.role && dto.role !== UserRole.ADMIN) {
      throw new BadRequestException("Cannot remove your own admin role");
    }

    const removesAdminAccess =
      target.role === UserRole.ADMIN &&
      target.isActive &&
      (dto.isActive === false || (dto.role !== undefined && dto.role !== UserRole.ADMIN));
    if (!removesAdminAccess) {
      return;
    }

    const activeAdminCount = await this.prisma.user.count({
      where: { role: UserRole.ADMIN, isActive: true }
    });
    if (activeAdminCount <= 1) {
      throw new BadRequestException("Cannot remove the last active admin");
    }
  }
}
