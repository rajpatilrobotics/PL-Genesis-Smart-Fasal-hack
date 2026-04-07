import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface UserProfile {
  id: number;
  clerkId: string;
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

export function useUserProfile() {
  return useQuery<{ exists: boolean; profile: UserProfile | null }>({
    queryKey: ["user-profile"],
    queryFn: () => apiFetch("/api/user/profile"),
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UserProfile>) =>
      apiFetch("/api/user/profile", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (result) => {
      if (result?.profile) {
        queryClient.setQueryData(["user-profile"], { exists: true, profile: result.profile });
      }
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}
