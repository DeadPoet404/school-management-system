import { QueryClient } from '@tanstack/react-query';

/**
 * Central QueryClient instance for TanStack Query.
 *
 * Default options:
 * - staleTime: 30s — data is considered fresh for 30 seconds,
 *   preventing unnecessary refetches when switching between tabs
 * - gcTime: 5min — unused cache entries are garbage collected after 5 min
 * - retry: 1 — one retry on network errors, then show the error state
 * - refetchOnWindowFocus: true — refresh data when user returns to the tab
 *
 * These defaults can be overridden per-query using queryOptions.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});
