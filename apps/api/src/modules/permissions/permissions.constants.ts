export const managedUserRoles = [
  "ADMIN",
  "HR_LEAD",
  "RECRUITER",
  "HIRING_MANAGER",
  "INTERVIEWER",
  "EXECUTIVE"
] as const;

export const managedPermissionResources = ["CANDIDATE", "TARGET_COMPANY", "JOB"] as const;

export const managedPermissionActions = ["DELETE"] as const;
