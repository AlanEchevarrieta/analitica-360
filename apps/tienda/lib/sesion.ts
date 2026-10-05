// Sesión del comprador. Solo servidor: el token vive en una cookie httpOnly
// (el JavaScript del navegador no la puede leer) y viaja a la API en el header
// x-sesion-tienda. La API guarda solo su hash y la sesión vale solo para esa tienda.
// La cookie es de la dirección exacta (sin Domain): una tienda no ve la de otra.
import { cookies } from "next/headers";
import { cabecerasTienda, urlTienda } from "./api";
import { obtenerSitio } from "./sitio";

const COOKIE = "tienda_sesion";

export type Cuenta = {
  email: string;
  nombre: string | null;
  telefono: string | null;
  calle: string | null;
  numero: string | null;
  piso: string | null;
  ciudad: string | null;
  provincia: string | null;
  codigoPostal: string | null;
  conGoogle: boolean;
};

export async function tokenSesion(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

/** Solo desde Server Functions (las cookies no se pueden escribir mientras se arma la página). */
export async function guardarSesion(token: string, expira: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expira),
  });
}

export async function borrarSesion() {
  (await cookies()).delete(COOKIE);
}

/** Fetch a /tienda/:empresa/cuenta... con la sesión. */
export async function apiCuenta(path: string, init: RequestInit = {}) {
  const sitio = await obtenerSitio();
  if (!sitio) throw new Error("Tienda no encontrada");
  const token = await tokenSesion();
  return fetch(urlTienda(sitio.empresaId, `/cuenta${path}`), {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(await cabecerasTienda()),
      ...(token ? { "x-sesion-tienda": token } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

/** La cuenta de quien navega, o null (sin sesión o vencida). */
export async function cuentaActual(): Promise<Cuenta | null> {
  if (!(await tokenSesion())) return null;
  try {
    const r = await apiCuenta("");
    return r.ok ? ((await r.json()) as Cuenta) : null;
  } catch {
    return null;
  }
}

export async function idsFavoritos(): Promise<string[]> {
  if (!(await tokenSesion())) return [];
  try {
    const r = await apiCuenta("/favoritos");
    return r.ok ? ((await r.json()) as string[]) : [];
  } catch {
    return [];
  }
}

export type PedidoCuenta = {
  numero: string;
  fecha: string;
  estado: string;
  numeroSeguimiento: string | null;
  transportista: string | null;
  subtotal: number;
  descuentos: number;
  total: number;
  items: { productoId: string; nombre: string; variante: string | null; cantidad: number; precio: number }[];
};

export async function misPedidos(): Promise<PedidoCuenta[]> {
  const r = await apiCuenta("/pedidos");
  return r.ok ? ((await r.json()) as PedidoCuenta[]) : [];
}
