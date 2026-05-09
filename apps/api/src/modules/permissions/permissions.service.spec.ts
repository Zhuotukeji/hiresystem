import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PermissionsService } from "./permissions.service";

function createService(storedPermissions: unknown[] = []) {
  const prisma = {
    rolePermission: {
      findMany: vi.fn().mockResolvedValue(storedPermissions),
      upsert: vi.fn((args) => args)
    },
    $transaction: vi.fn((operations) => Promise.resolve(operations))
  };
  return { prisma, service: new PermissionsService(prisma as never) };
}

describe("PermissionsService", () => {
  it("keeps ADMIN permissions always enabled", async () => {
    const { service } = createService();

    const result = await service.getCurrentUserPermissions("ADMIN");

    expect(result.can.CANDIDATE.DELETE).toBe(true);
    expect(result.can.TARGET_COMPANY.DELETE).toBe(true);
    expect(result.can.JOB.DELETE).toBe(true);
  });

  it("uses stored role permissions for non-admin roles", async () => {
    const { service } = createService([
      { role: "HR_LEAD", resource: "JOB", action: "DELETE", allowed: true }
    ]);

    const result = await service.getCurrentUserPermissions("HR_LEAD");

    expect(result.can.JOB.DELETE).toBe(true);
    expect(result.can.CANDIDATE.DELETE).toBe(false);
  });

  it("does not allow disabling ADMIN permissions", async () => {
    const { service } = createService();

    await expect(
      service.updateRolePermissions({
        permissions: [{ role: "ADMIN", resource: "JOB", action: "DELETE", allowed: false }]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
