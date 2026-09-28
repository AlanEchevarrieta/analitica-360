import { cache } from "react";
import { headers } from "next/headers";
import { apiUrl } from "./api";

/** La tienda del negocio que corresponde a la dirección visitada (config pública de Analítica 360). */
export type Sitio = {
  empresaId: string;
  subdominio: string;
  dominioPropio: string | null;
  nombre: string;
  descripcion: string | null;
  color: string;
  logoUrl: string | null;
  whatsapp: string | null;
  instagram: string | null;
  textoEnvios: string | null;
  alias: string | null;
  cbu: string | null;
  titular: string | null;
  mostrarSinStock: boolean;
  /** Estética elegida en Analítica 360 (ver globals.css). */
  fondo: "puntos" | "lienzo" | "papel" | "rayas" | "ondas" | "liso";
  tipografia: "clasica" | "elegante" | "moderna" | "amigable";
  bordes: "redondeados" | "suaves" | "rectos";
  portadaUrl: string | null;
  anuncio: string | null;
};

/**
 * Una sola consulta por request (React cache). El host sale de la dirección
 * pedida: acacia.analitica360.app, un dominio propio o, en desarrollo,
 * acacia.localhost:3010. TIENDA_HOST_FORZADO sirve para probar sin subdominio.
 */
export const obtenerSitio = cache(async (): Promise<Sitio | null> => {
  const h = await headers();
  const host = process.env.TIENDA_HOST_FORZADO || h.get("x-forwarded-host") || h.get("host") || "";
  try {
    const res = await fetch(`${apiUrl()}/tienda-sitio?host=${encodeURIComponent(host)}`, { next: { revalidate: 10 } });
    if (!res.ok) return null;
    return (await res.json()) as Sitio;
  } catch (error) {
    console.error("Tienda: no se pudo conectar con la API", error);
    return null;
  }
});
