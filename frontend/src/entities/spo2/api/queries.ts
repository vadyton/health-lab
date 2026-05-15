import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { spo2Api } from "./spo2Api";
import { qk } from "@/shared/api/queryKeys";

type Range = "day" | "week" | "month" | "year";

export function useSpo2(date: string, range: Range) {
  return useQuery({
    queryKey: qk.spo2.data(date, range),
    queryFn:  () => spo2Api.query(date, range),
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
