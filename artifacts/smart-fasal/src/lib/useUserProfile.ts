import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface UserProfile {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  village: string | null;
  district: string | null;
  state: string | null;
  farmSizeAcres: number | null;
  primaryCrop: string | null;
  farmingExperienceYears: number | null;
  profileComplete: boolean;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export function useUserProfile() {
  return useQuery<{ exists: boolean; profile: UserProfile | null }>({
    queryKey: ["user-profile"],
    queryFn: () => apiFetch("/user/profile"),
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UserProfile>) =>
      apiFetch("/user/profile", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (result) => {
      if (result?.profile) {
        queryClient.setQueryData(["user-profile"], { exists: true, profile: result.profile });
      }
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}
