"use server";

import { cabecerasTienda, mensajeDeError, urlTienda } from "@/lib/api";
import { armarDireccion, type DatosEnvio, type ItemPedidoInput } from "@/lib/pedidos";
import { obtenerSitio } from "@/lib/sitio";

export type ResultadoPedido =
  | { ok: true; id: string; numeroPedido: string; total: number }
  | { ok: false; error: string };

// El precio no se manda: la API lo toma de la base, no del carrito del browser.
export async function crearPedidoTienda(input: {
  envio: DatosEnvio;
  items: Pick<ItemPedidoInput, "productoId" | "varianteId" | "cantidad">[];
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
  };

  try {
    const res = await fetch(urlTienda(sitio.empresaId, "/pedidos"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecerasTienda()) },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (res.status === 429) {
      return { ok: false, error: "Hiciste muchos pedidos seguidos. Esperá un minuto y probá de nuevo." };
    }
    if (!res.ok) {
      return { ok: false, error: await mensajeDeError(res, "No se pudo crear el pedido. Probá de nuevo.") };
    }
    const data = (await res.json()) as { id: string; numeroPedido: string; total: number };
    return { ok: true, id: data.id, numeroPedido: data.numeroPedido, total: Number(data.total) };
  } catch (error) {
    console.error("Pedido: no se pudo conectar con la API", error);
    return { ok: false, error: "No pudimos conectar con la tienda. Probá de nuevo en unos minutos." };
  }
}
