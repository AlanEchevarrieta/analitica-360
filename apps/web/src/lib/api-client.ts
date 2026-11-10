const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const EVENTO_SESION_EXPIRADA = "a360:sesion-expirada";

/** Margen en segundos antes del vencimiento del JWT (60s en Clerk) para renovarlo de forma preventiva. */
const MARGEN_EXPIRACION_SEG = 10;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RefrescadorToken = () => Promise<string | null>;

let refrescadorGlobal: RefrescadorToken | null = null;
let promesaRefreshEnCurso: Promise<string | null> | null = null;

/** Registra la función de Clerk (`getToken({ skipCache: true })`) para renovar el JWT ante un 401 o por expiración preventiva. */
export function registrarRefrescadorSesion(fn: RefrescadorToken | null) {
  refrescadorGlobal = fn;
}

/**
 * Decodifica el payload de un JWT (sin verificar firma, eso lo hace el backend)
 * y devuelve `true` si el token ya venció o le quedan menos de `margenSeg` segundos.
 */
export function tokenPorVencer(token: string | null | undefined, margenSeg = MARGEN_EXPIRACION_SEG, ahoraMs = Date.now()): boolean {
  if (!token) return true;
  const partes = token.split(".");
  if (partes.length !== 3) return false;
  try {
    const base64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("utf-8");
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 <= ahoraMs + margenSeg * 1000;
  } catch {
    return false;
  }
}

/** Pide un token nuevo a Clerk evitando múltiples llamadas simultáneas si varios requests se disparan a la vez. */
export async function obtenerTokenFresco(refrescador?: RefrescadorToken): Promise<string | null> {
  const fn = refrescador ?? refrescadorGlobal;
  if (!fn) return null;
  if (!promesaRefreshEnCurso) {
    promesaRefreshEnCurso = fn()
      .catch(() => null)
      .finally(() => {
        promesaRefreshEnCurso = null;
      });
  }
  return promesaRefreshEnCurso;
}

export function esRutaPublica(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/terminos") ||
    pathname.startsWith("/privacidad") ||
    pathname.startsWith("/ticket") ||
    pathname.startsWith("/guias") ||
    pathname.startsWith("/bienvenida") ||
    pathname.startsWith("/elegir-empresa") ||
    pathname.startsWith("/aprobar")
  );
}

/** Avisa a la UI que la sesión realmente expiró luego de fallar el refresh token (solo si hay conexión a internet). */
export function notificarSesionExpirada() {
  if (typeof window === "undefined") return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (esRutaPublica(window.location.pathname)) return;
  window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA));
}

function armarHeaders(token: string | null, init?: RequestInit): HeadersInit {
  return {
    // Con FormData (subida de archivos) el navegador arma el Content-Type con su separador.
    ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...init?.headers,
  };
}

/** Resuelve el token inicial: si está vacío o por vencer en <10s, pide uno fresco preventivamente. */
async function asegurarTokenVigente(token: string | null, refrescador?: RefrescadorToken): Promise<string | null> {
  if (!token || tokenPorVencer(token)) {
    const fresco = await obtenerTokenFresco(refrescador);
    if (fresco) return fresco;
  }
  return token;
}

/** Fetch autenticado contra apps/api con refresh preventivo y reintento automático ante un 401. */
export async function apiFetch<T>(
  path: string,
  token: string | null,
  init?: RequestInit,
  refrescador?: RefrescadorToken,
): Promise<T> {
  let tokenActual = await asegurarTokenVigente(token, refrescador);

  let res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: armarHeaders(tokenActual, init),
  });

  // Si dio 401 (JWT de 60s vencido al volver a la pestaña o desfase), forzamos refresh sin caché y reintentamos 1 vez.
  if (res.status === 401) {
    const tokenRenovado = await obtenerTokenFresco(refrescador);
    if (tokenRenovado && tokenRenovado !== tokenActual) {
      tokenActual = tokenRenovado;
      res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: armarHeaders(tokenActual, init),
      });
    } else if (!tokenRenovado) {
      notificarSesionExpirada();
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      notificarSesionExpirada();
    }
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? `Error ${res.status} al llamar ${path}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Igual que apiFetch, pero para descargar un archivo (PDF): devuelve el contenido sin leerlo como JSON. */
export async function apiArchivo(
  path: string,
  token: string | null,
  refrescador?: RefrescadorToken,
): Promise<Blob> {
  let tokenActual = await asegurarTokenVigente(token, refrescador);

  let res = await fetch(`${API_URL}${path}`, {
    headers: tokenActual ? { Authorization: `Bearer ${tokenActual}` } : {},
  });

  if (res.status === 401) {
    const tokenRenovado = await obtenerTokenFresco(refrescador);
    if (tokenRenovado && tokenRenovado !== tokenActual) {
      tokenActual = tokenRenovado;
      res = await fetch(`${API_URL}${path}`, {
        headers: { Authorization: `Bearer ${tokenActual}` },
      });
    } else if (!tokenRenovado) {
      notificarSesionExpirada();
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      notificarSesionExpirada();
    }
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? `Error ${res.status} al descargar`);
  }
  return res.blob();
}
