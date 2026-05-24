import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export function useDailyContent() {
  return useQuery({
    queryKey: ["daily-content"],
    queryFn: async () => {
      try {
        return await api.getDailyContent();
      } catch {
        return null;
      }
    },
    staleTime: 60 * 60 * 1000,
    retry: 0,
  });
}
