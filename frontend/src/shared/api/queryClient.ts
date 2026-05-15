import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:        5 * 60 * 1000,  // 5 min — consider fresh
      gcTime:           30 * 60 * 1000, // 30 min — keep in memory
      retry:            1,
      refetchOnWindowFocus: false,
    },
  },
});
