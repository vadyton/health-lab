import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { heartRateApi } from "./heartRateApi";
import { qk } from "@/shared/api/queryKeys";

type Range = "day" | "week" | "month" | "year";

export function useHeartRate(date: string, range: Range) {
  return useQuery({
    queryKey: qk.heartRate.data(date, range),
    queryFn:  () => heartRateApi.query(date, range),
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
