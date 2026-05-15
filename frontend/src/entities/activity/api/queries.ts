import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { activitiesApi } from "./activitiesApi";
import { qk } from "@/shared/api/queryKeys";

export function useActivitiesSummary() {
  return useQuery({
    queryKey: qk.activities.summary(),
    queryFn:  () => activitiesApi.summary(),
    staleTime: Infinity,
  });
}

export function useActivitiesList(source?: string) {
  return useInfiniteQuery({
    queryKey:     [...qk.activities.list(), source ?? "all"],
    queryFn:      ({ pageParam }) => activitiesApi.list(30, pageParam as number, source),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    staleTime: Infinity,
  });
}

export function useActivityDetail(id: string) {
  return useQuery({
    queryKey: qk.activities.detail(id),
    queryFn:  () => activitiesApi.getOne(id),
    staleTime: 10 * 60 * 1000,
  });
}
