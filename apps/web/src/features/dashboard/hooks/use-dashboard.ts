"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import type { DashboardInicio } from "../types";

/** GET /analytics/dashboard (DashboardController). */
export function useDashboard() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({
    queryKey: ["dashboard", orgId],
    queryFn: () => api<DashboardInicio>("/analytics/dashboard"),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  });
}
