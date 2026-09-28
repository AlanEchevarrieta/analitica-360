// Cliente de la API pública de Analítica 360 (módulo `tienda`).
// Solo se usa desde el servidor (Server Components y Server Actions): la URL
// de la API no viaja al browser. La empresa sale de la dirección visitada (lib/sitio).

export function apiUrl() {
  return (process.env.ANALITICA_API_URL ?? "").replace(/\/+$/, "");
}

/**
 * Cabeceras para la API: la clave de la tienda y la IP del cliente que hizo
 * el request, para que el límite de pedidos por minuto sea por cliente y no
 * por el servidor de la tienda (ver TiendaThrottlerGuard en la API).
 */
export async function cabecerasTienda(): Promise<Record<string, string>> {
  const clave = process.env.ANALITICA_TIENDA_KEY;
  if (!clave) return {};
  const { headers } = await import("next/headers");
  const entrantes = await headers();
  const ip = entrantes.get("x-forwarded-for")?.split(",")[0]?.trim() || entrantes.get("x-real-ip") || "";
  return ip ? { "x-tienda-key": clave, "x-forwarded-for": ip } : { "x-tienda-key": clave };
}

export function urlTienda(empresaId: string, path: string) {
  return `${apiUrl()}/tienda/${empresaId}${path}`;
}

/** Mensaje legible de un error de la API de Nest ({ message: string | string[] }). */
export async function mensajeDeError(res: Response, porDefecto: string) {
  try {
    const body = (await res.json()) as { message?: unknown; issues?: { message?: unknown }[] };
    // Errores de validación (ZodValidationPipe): el primer campo con problema.
    const issue = body.issues?.[0]?.message;
    if (typeof issue === "string") return issue;
    if (typeof body.message === "string") return body.message;
    if (Array.isArray(body.message) && body.message.length > 0) return String(body.message[0]);
  } catch {
    /* respuesta sin JSON */
  }
  return porDefecto;
}
