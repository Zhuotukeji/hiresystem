import type { CurrentPermissions, PermissionResource, User } from "../api/types";

export const userRoleList = ["ADMIN", "HR_LEAD", "RECRUITER", "HIRING_MANAGER", "INTERVIEWER", "EXECUTIVE"] as const;

export const permissionResourceList = ["CANDIDATE", "TARGET_COMPANY", "JOB"] as const;

export const resourceLabels: Record<PermissionResource, string> = {
  CANDIDATE: "候选人",
  TARGET_COMPANY: "目标公司",
  JOB: "岗位"
};

export function isAdmin(user?: Pick<User, "role"> | null) {
  return user?.role === "ADMIN";
}

export function canDeleteResource(permissions: CurrentPermissions | undefined, resource: PermissionResource) {
  return Boolean(permissions?.can?.[resource]?.DELETE);
}
