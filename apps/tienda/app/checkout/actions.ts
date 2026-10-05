"use server";

import { cabecerasTienda, mensajeDeError, urlTienda } from "@/lib/api";
import { armarDireccion, type DatosEnvio, type ItemPedidoInput } from "@/lib/pedidos";
import { apiCuenta, tokenSesion } from "@/lib/sesion";
import { obtenerSitio } from "@/lib/sitio";

export type ResultadoPedido =
  | { ok: true; id: string; numeroPedido: string; subtotal: number; descuentoCupon: number; descuentoTransferencia: number; total: number }
  | { ok: false; error: string };

export type FormaPago = "transferencia" | "a_coordinar";

/** ¿Vale el cupón con este subtotal? (el pedido lo vuelve a verificar en el servidor). */
export async function validarCupon(codigo: string, subtotal: number): Promise<{ valido: true; codigo: string; descuento: number } | { valido: false; mensaje: string }> {
  if (!codigo.trim()) return { valido: false, mensaje: "Ingresá el código" };
  const sitio = await obtenerSitio();
  if (!sitio) return { valido: false, mensaje: "Esta tienda no está disponible" };
  try {
    const res = await fetch(urlTienda(sitio.empresaId, "/cupones/validar"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecerasTienda()) },
      body: JSON.stringify({ codigo: codigo.slice(0, 40), subtotal }),
      cache: "no-store",
    });
    if (res.status === 429) return { valido: false, mensaje: "Probaste muchos códigos seguidos. Esperá un minuto." };
    if (!res.ok) return { valido: false, mensaje: await mensajeDeError(res, "No pudimos verificar el código") };
    return (await res.json()) as { valido: true; codigo: string; descuento: number } | { valido: false; mensaje: string };
  } catch {
    return { valido: false, mensaje: "No pudimos verificar el código. Probá de nuevo." };
  }
}

// El precio no se manda: la API lo toma de la base (con ofertas, cupón y transferencia), no del carrito del browser.
export async function crearPedidoTienda(input: {
  envio: DatosEnvio;
  items: Pick<ItemPedidoInput, "productoId" | "varianteId" | "cantidad">[];
  cuponCodigo: string | null;
  formaPago: FormaPago;
  /** Con sesión: guardar estos datos en la cuenta para la próxima compra. */
  guardarDatos?: boolean;
}): Promise<ResultadoPedido> {
  if (input.items.length === 0) return { ok: false, error: "El carrito está vacío" };
  // La tienda sale de la dirección visitada: el navegador no elige a qué negocio se le pide.
  const sitio = await obtenerSitio();
  if (!sitio) return { ok: false, error: "Esta tienda no está disponible" };

  const e = input.envio;
  const body = {
    clienteNombre: e.nombre.trim(),
    clienteEmail: e.email.trim(),
    clienteTelefono: e.telefono.trim(),
    direccionEnvio: armarDireccion(e),
    codigoPostal: e.codigoPostal.trim(),
    localidad: e.ciudad.trim(),
    provincia: e.provincia.trim(),
    notas: e.notas.trim() || null,
    items: input.items.map((i) => ({
      productoId: i.productoId,
      varianteId: i.varianteId,
      cantidad: i.cantidad,
    })),
    cuponCodigo: input.cuponCodigo,
    formaPago: input.formaPago,
  };

  try {
    const token = await tokenSesion();
    const res = await fetch(urlTienda(sitio.empresaId, "/pedidos"), {
      method: "POST",
      // Con sesión, el pedido queda en "Mis pedidos" (la API lo ata a la cuenta).
      headers: { "Content-Type": "application/json", ...(await cabecerasTienda()), ...(token ? { "x-sesion-tienda": token } : {}) },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (res.status === 429) {
      return { ok: false, error: "Hiciste muchos pedidos seguidos. Esperá un minuto y probá de nuevo." };
    }
    if (!res.ok) {
      return { ok: false, error: await mensajeDeError(res, "No se pudo crear el pedido. Probá de nuevo.") };
    }
    if (input.guardarDatos && token) {
      await apiCuenta("", {
        method: "PATCH",
        body: JSON.stringify({ nombre: e.nombre, telefono: e.telefono, calle: e.calle, numero: e.numero, piso: e.piso || null, ciudad: e.ciudad, provincia: e.provincia, codigoPostal: e.codigoPostal }),
      }).catch(() => {});
    }
    const d = (await res.json()) as { id: string; numeroPedido: string; subtotal: number; descuentoCupon: number; descuentoTransferencia: number; total: number };
    return {
      ok: true,
      id: d.id,
      numeroPedido: d.numeroPedido,
      subtotal: Number(d.subtotal ?? d.total),
      descuentoCupon: Number(d.descuentoCupon ?? 0),
      descuentoTransferencia: Number(d.descuentoTransferencia ?? 0),
      total: Number(d.total),
    };
  } catch (error) {
    console.error("Pedido: no se pudo conectar con la API", error);
    return { ok: false, error: "No pudimos conectar con la tienda. Probá de nuevo en unos minutos." };
  }
}
