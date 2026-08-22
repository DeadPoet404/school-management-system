"use client"

import { useQuery } from "@tanstack/react-query"
import {
  getDashboardData,
  type DashboardData,
} from "@/lib/api/dashboard"

export function useDashboardData() {
  return useQuery<DashboardData, Error>({
    queryKey: ["dashboard-data"],
    queryFn: getDashboardData,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}
