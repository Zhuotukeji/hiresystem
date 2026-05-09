import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { CurrentPermissions, User } from "../api/types";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<User>("/auth/me")
  });
}

export function useCurrentPermissions() {
  return useQuery({
    queryKey: ["permissions", "me"],
    queryFn: () => api.get<CurrentPermissions>("/permissions/me")
  });
}
