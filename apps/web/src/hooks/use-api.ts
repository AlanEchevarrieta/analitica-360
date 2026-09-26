"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { apiFetch } from "@/lib/api-client";

/** Devuelve una función fetch ya atada al token de sesión de Clerk, lista para pasar a TanStack Query. */
export function useApiFetch({ permitirPendiente = false }: { permitirPendiente?: boolean } = {}) {
  // permitirPendiente: sesión de una cuenta nueva que todavía no tiene empresa (solo el registro).
  const { getToken } = useAuth({ treatPendingAsSignedOut: !permitirPendiente });
  return useCallback(
    async <T>(path: string, init?: RequestInit) => {
      const token = await getToken();
      return apiFetch<T>(path, token, init);
    },
    [getToken],
  );
}
