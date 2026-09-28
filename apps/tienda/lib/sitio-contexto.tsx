"use client";

import { createContext, useContext } from "react";
import type { Sitio } from "./sitio";

const Contexto = createContext<Sitio | null>(null);

export function SitioProvider({ sitio, children }: { sitio: Sitio; children: React.ReactNode }) {
  return <Contexto.Provider value={sitio}>{children}</Contexto.Provider>;
}

/** Datos públicos de la tienda (nombre, WhatsApp, datos para transferir…). */
export function useSitio(): Sitio {
  const s = useContext(Contexto);
  if (!s) throw new Error("useSitio fuera de SitioProvider");
  return s;
}
