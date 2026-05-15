import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { bodyApi } from "./bodyApi";
import { qk } from "@/shared/api/queryKeys";

type Range = "month" | "year" | "all";

export function useBody(date: string, range: Range) {
  return useQuery({
    queryKey: qk.body.data(date, range),
    queryFn:  () => bodyApi.query(date, range),
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
