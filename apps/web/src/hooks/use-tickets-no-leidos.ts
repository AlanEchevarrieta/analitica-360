"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "./use-api";

/** GET /tickets/no-leidos (ver apps/api modules/soporte/ticket.controller.ts). */
export function useTicketsNoLeidos() {
  const api = useApiFetch();
  const { isSignedIn, orgId } = useAuth();
  return useQuery({
    queryKey: ["tickets-no-leidos", orgId],
    queryFn: () => api<number>("/tickets/no-leidos"),
    enabled: Boolean(isSignedIn && orgId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
