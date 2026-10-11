import { PRECIO_MENSUAL } from "@/features/planes/planes";
import type { PreciosLista } from "./contenido";

/**
 * Precios de lista vigentes para la landing (cambian con los aumentos por IPC
 * programados en la consola). Se piden a la API desde el servidor y se guardan
 * una hora. Si la API no responde, la landing muestra los precios de respaldo.
 */
export async function preciosVigentes(): Promise<PreciosLista> {
  const api = process.env.API_URL_INTERNA ?? process.env.NEXT_PUBLIC_API_URL;
  if (!api) return PRECIO_MENSUAL;
  try {
    const r = await fetch(`${api}/planes/precios`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(3000) });
    if (!r.ok) return PRECIO_MENSUAL;
    const { precios } = (await r.json()) as { precios: Partial<PreciosLista> };
    const valido = (n: unknown): n is number => typeof n === "number" && n > 0;
    return {
      basico: valido(precios?.basico) ? precios.basico : PRECIO_MENSUAL.basico,
      pro: valido(precios?.pro) ? precios.pro : PRECIO_MENSUAL.pro,
      ecommerce: valido(precios?.ecommerce) ? precios.ecommerce : PRECIO_MENSUAL.ecommerce,
    };
  } catch {
    return PRECIO_MENSUAL;
  }
}
