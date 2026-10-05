"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";
import { useMoneda } from "@/lib/moneda";
import type { DashboardInicio } from "../types";

/** GET /analytics/dashboard (DashboardController). */
export function useDashboard() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const moneda = useMoneda();
  return useQuery({
    queryKey: ["dashboard", orgId, moneda],
    queryFn: () => api<DashboardInicio>(moneda === "USD" ? "/analytics/dashboard?moneda=USD" : "/analytics/dashboard"),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  });
}
