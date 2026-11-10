"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { apiFetch, tokenPorVencer } from "@/lib/api-client";

/** Devuelve una función fetch ya atada al token de sesión de Clerk (con refresh preventivo y ante 401), lista para pasar a TanStack Query. */
export function useApiFetch({ permitirPendiente = false }: { permitirPendiente?: boolean } = {}) {
  // permitirPendiente: sesión de una cuenta nueva que todavía no tiene empresa (solo el registro).
  const { getToken } = useAuth({ treatPendingAsSignedOut: !permitirPendiente });
  return useCallback(
    async <T>(path: string, init?: RequestInit) => {
      let token = await getToken();
      if (!token || tokenPorVencer(token)) {
        token = (await getToken({ skipCache: true })) ?? token;
      }
      return apiFetch<T>(path, token, init, () => getToken({ skipCache: true }));
    },
    [getToken],
  );
}
