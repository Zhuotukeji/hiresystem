import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { UsersService } from "./users.service";

function createService(targetUser: unknown, activeAdminCount = 1) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(targetUser),
      count: vi.fn().mockResolvedValue(activeAdminCount),
      update: vi.fn((args) => Promise.resolve({ id: args.where.id, ...args.data }))
    }
  };
  return { prisma, service: new UsersService(prisma as never) };
}

describe("UsersService admin safety", () => {
  it("does not allow an admin to disable their own account", async () => {
    const { service } = createService({ id: "u1", role: "ADMIN", isActive: true });

    await expect(service.disable("u1", "u1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not allow removing the last active admin", async () => {
    const { service } = createService({ id: "u1", role: "ADMIN", isActive: true }, 1);

    await expect(service.update("u1", { role: "RECRUITER" }, "u2")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows enabling an inactive account", async () => {
    const { service, prisma } = createService({ id: "u1", role: "RECRUITER", isActive: false });

    await service.update("u1", { isActive: true }, "admin");

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ isActive: true })
      })
    );
  });
});
