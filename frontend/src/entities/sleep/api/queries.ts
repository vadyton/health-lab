import { useQuery } from "@tanstack/react-query";
import { sleepApi } from "./sleepApi";
import { qk } from "@/shared/api/queryKeys";

export function useSleepSummary() {
  return useQuery({
    queryKey: qk.sleep.summary(),
    queryFn:  () => sleepApi.summary(),
    staleTime: Infinity,
  });
}

export function useSleepDetail(id: string | null) {
  return useQuery({
    queryKey: qk.sleep.detail(id!),
    queryFn:  () => sleepApi.getOne(id!),
    enabled:  !!id,
    staleTime: 10 * 60 * 1000,
  });
}
