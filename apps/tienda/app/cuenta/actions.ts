"use server";

import { revalidatePath } from "next/cache";
import { mensajeDeError } from "@/lib/api";
import { apiCuenta, borrarSesion, guardarSesion, type Cuenta } from "@/lib/sesion";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function error(res: Response, porDefecto: string): Promise<{ ok: false; error: string }> {
  if (res.status === 429) return { ok: false, error: "Hiciste muchos intentos seguidos. Esperá un minuto." };
  return { ok: false, error: await mensajeDeError(res, porDefecto) };
}

const sinConexion = { ok: false as const, error: "No pudimos conectar con la tienda. Probá de nuevo." };

export async function pedirCodigo(email: string): Promise<Resultado> {
  try {
    const r = await apiCuenta("/codigo", { method: "POST", body: JSON.stringify({ email: email.trim().slice(0, 160) }) });
    return r.ok ? { ok: true } : error(r, "No pudimos mandarte el código");
  } catch {
    return sinConexion;
  }
}

async function abrir(r: Response): Promise<Resultado<{ cuenta: Cuenta }>> {
  if (!r.ok) return error(r, "No pudimos iniciar sesión");
  const d = (await r.json()) as { token: string; expira: string; cuenta: Cuenta };
  await guardarSesion(d.token, d.expira);
  revalidatePath("/", "layout");
  return { ok: true, cuenta: d.cuenta };
}

export async function ingresarConCodigo(email: string, codigo: string): Promise<Resultado<{ cuenta: Cuenta }>> {
  try {
    return await abrir(await apiCuenta("/ingresar", { method: "POST", body: JSON.stringify({ email: email.trim(), codigo: codigo.replace(/\D/g, "").slice(0, 6) }) }));
  } catch {
    return sinConexion;
  }
}

export async function ingresarConGoogle(credential: string): Promise<Resultado<{ cuenta: Cuenta }>> {
  try {
    return await abrir(await apiCuenta("/google", { method: "POST", body: JSON.stringify({ credential }) }));
  } catch {
    return sinConexion;
  }
}

export async function salir() {
  await apiCuenta("/salir", { method: "POST" }).catch(() => {});
  await borrarSesion();
  revalidatePath("/", "layout");
}

export type DatosCuenta = Omit<Cuenta, "email" | "conGoogle">;

export async function guardarDatos(datos: DatosCuenta): Promise<Resultado<{ cuenta: Cuenta }>> {
  try {
    const r = await apiCuenta("", { method: "PATCH", body: JSON.stringify(datos) });
    if (!r.ok) return error(r, "No pudimos guardar tus datos");
    revalidatePath("/mi-cuenta");
    return { ok: true, cuenta: (await r.json()) as Cuenta };
  } catch {
    return sinConexion;
  }
}

export async function borrarCuenta(): Promise<Resultado> {
  try {
    const r = await apiCuenta("", { method: "DELETE" });
    if (!r.ok) return error(r, "No pudimos borrar la cuenta");
    await borrarSesion();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return sinConexion;
  }
}

/** Devuelve los favoritos actualizados, o null si no hay sesión (hay que ingresar). */
export async function alternarFavorito(productoId: string, marcar: boolean): Promise<string[] | null> {
  try {
    const r = await apiCuenta(`/favoritos/${encodeURIComponent(productoId)}`, { method: marcar ? "PUT" : "DELETE" });
    if (r.status === 401) return null;
    return r.ok ? ((await r.json()) as string[]) : null;
  } catch {
    return null;
  }
}
