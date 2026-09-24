"use client";

import { useAuth } from "@clerk/nextjs";
import { rolDesdeClerk, type Rol } from "@/lib/rol";

/** Rol normalizado del usuario en la organización (empresa) activa. */
export function useRol(): Rol {
  const { orgRole } = useAuth();
  return rolDesdeClerk(orgRole);
}
