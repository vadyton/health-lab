import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { stepsApi } from "./stepsApi";
import { qk } from "@/shared/api/queryKeys";

type Range = "day" | "week" | "month" | "year" | "all";

export function useSteps(date: string, range: Range) {
  return useQuery({
    queryKey: qk.steps.data(date, range),
    queryFn:  () => stepsApi.query(date, range),
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
