import { describe, expect, it } from "vitest";
import { canDeleteResource, isAdmin } from "./permissions";
import type { CurrentPermissions } from "../api/types";

describe("permission helpers", () => {
  it("detects admin users", () => {
    expect(isAdmin({ role: "ADMIN" })).toBe(true);
    expect(isAdmin({ role: "HR_LEAD" })).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it("checks delete capability by resource", () => {
    const permissions: CurrentPermissions = {
      role: "HR_LEAD",
      permissions: [],
      can: {
        CANDIDATE: { DELETE: true },
        TARGET_COMPANY: { DELETE: false },
        JOB: { DELETE: false }
      }
    };

    expect(canDeleteResource(permissions, "CANDIDATE")).toBe(true);
    expect(canDeleteResource(permissions, "TARGET_COMPANY")).toBe(false);
    expect(canDeleteResource(undefined, "JOB")).toBe(false);
  });
});
