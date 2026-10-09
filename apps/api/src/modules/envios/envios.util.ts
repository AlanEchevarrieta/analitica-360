// Lo que no habla con Zipnova: armar los bultos, leer la cotización y traducir estados.
// API: https://api.zipnova.com.ar/docs (v2).

export interface ProductoEnvio {
  cantidad: number;
  pesoGr: number | null;
  altoCm: number | null;
  anchoCm: number | null;
  largoCm: number | null;
  nombre?: string;
}

export interface ItemZipnova {
  weight: number;
  height: number;
  width: number;
  length: number;
  description?: string;
}

/** Una opción para el cliente. `codigo` identifica transportista, servicio y modalidad para volver a cotizar y crear el envío. */
export interface OpcionEnvio {
  codigo: string;
  transportista: string;
  servicio: string;
  precio: number;
  /** Fecha estimada de entrega (AAAA-MM-DD) o null. */
  llegada: string | null;
}

const MAX_UNIDADES = 100;
const entre = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

/**
 * Un ítem por unidad (Zipnova arma las cajas con type_packaging "dynamic"). Sin peso, va el peso por defecto
 * de la empresa; sin medidas, una caja chica de 10 cm. Si son muchas unidades, se agrupan en 100 para no
 * mandar pedidos gigantes (mismo peso total).
 */
export function itemsZipnova(productos: ProductoEnvio[], pesoDefectoGr: number): ItemZipnova[] {
  const unidades: ItemZipnova[] = [];
  for (const p of productos) {
    const item: ItemZipnova = {
      weight: entre(p.pesoGr ?? pesoDefectoGr, 10, 10_000_000),
      height: entre(p.altoCm ?? 10, 1, 5000),
      width: entre(p.anchoCm ?? 10, 1, 5000),
      length: entre(p.largoCm ?? 10, 1, 5000),
      ...(p.nombre ? { description: p.nombre.slice(0, 60) } : {}),
    };
    for (let i = 0; i < p.cantidad; i++) unidades.push(item);
  }
  if (unidades.length <= MAX_UNIDADES) return unidades;
  const pesoTotal = unidades.reduce((a, u) => a + u.weight, 0);
  const grupo = Math.ceil(unidades.length / MAX_UNIDADES);
  return unidades
    .filter((_, i) => i % grupo === 0)
    .map((u) => ({ ...u, weight: entre(pesoTotal / Math.ceil(unidades.length / grupo), 10, 10_000_000) }));
}

/** Calle, número y el resto ("Av. San Martín 1234 piso 2" → San Martín 1234, extras "piso 2"). Sin número: "S/N". */
export function partirDireccion(direccion: string): { street: string; street_number: string; street_extras?: string } {
  const d = direccion.trim().replace(/\s+/g, ' ');
  // Con "Nº 345" el número es ese (la calle puede tener números: "Calle 12 Nº 345"); si no, el primero después de la calle.
  const m = /^(.+?)\s+N[°ºo]\.?\s*(\d{1,6}[A-Za-z]?)\b\s*[,-]?\s*(.*)$/i.exec(d) ?? /^(.*?\D)\s*(\d{1,6}[A-Za-z]?)\b\s*[,-]?\s*(.*)$/.exec(d);
  if (!m || !m[1].trim()) return { street: d.slice(0, 100), street_number: 'S/N' };
  const extras = m[3].trim();
  return { street: m[1].trim().replace(/[,]$/, '').slice(0, 100), street_number: m[2], ...(extras ? { street_extras: extras.slice(0, 100) } : {}) };
}

interface ResultadoCotizacion {
  selectable?: boolean;
  logistic_type?: string;
  carrier?: { id?: number; name?: string };
  service_type?: { code?: string; name?: string };
  amounts?: { price?: number; price_incl_tax?: number };
  delivery_time?: { estimated_delivery?: string | null };
}

export const codigoOpcion = (r: { carrierId: number; servicio: string; logistica: string }) => `${r.carrierId}:${r.servicio}:${r.logistica}`;

export function leerCodigo(codigo: string): { carrierId: number; servicio: string; logistica: string } | null {
  const m = /^(\d{1,9}):([a-z0-9_]{1,60}):([a-z0-9_]{1,60})$/.exec(codigo);
  return m ? { carrierId: Number(m[1]), servicio: m[2], logistica: m[3] } : null;
}

/**
 * Las opciones elegibles, de la más barata a la más cara. Por ahora solo envío a domicilio: el retiro en
 * sucursal del correo pide elegir el punto, y queda para más adelante.
 */
export function leerCotizacion(respuesta: unknown): OpcionEnvio[] {
  const resultados = (respuesta as { results?: Record<string, ResultadoCotizacion> | ResultadoCotizacion[] })?.results;
  const lista = Array.isArray(resultados) ? resultados : Object.values(resultados ?? {});
  return lista
    .filter((r) => r.selectable !== false && r.carrier?.id && r.service_type?.code && r.logistic_type)
    .filter((r) => !/pickup_point|sucursal/i.test(r.service_type!.code!))
    .map((r) => ({
      codigo: codigoOpcion({ carrierId: r.carrier!.id!, servicio: r.service_type!.code!, logistica: r.logistic_type! }),
      transportista: r.carrier!.name ?? 'Correo',
      servicio: r.service_type!.name ?? r.service_type!.code!,
      precio: Math.round(Number(r.amounts?.price_incl_tax ?? r.amounts?.price ?? 0)),
      llegada: r.delivery_time?.estimated_delivery ? r.delivery_time.estimated_delivery.slice(0, 10) : null,
    }))
    .filter((o) => o.precio > 0)
    .sort((a, b) => a.precio - b.precio);
}

const CON_TRANSPORTISTA = new Set([
  'shipped',
  'in_transit_to_crossdock',
  'admitted',
  'xd_pending',
  'crossdock',
  'in_transit_to_carrier',
  'received_by_carrier',
  'in_transit',
  'delivery_attempt',
  'out_for_delivery',
  'available_for_pickup',
  'not_delivered',
]);
const ENTREGADO = new Set(['delivered', 'delivered_with_damage']);

/** A qué estado del pedido lleva un estado de Zipnova (null = no cambia nada). */
export function estadoPedidoDesde(estadoZipnova: string | null | undefined): 'con_transportista' | 'entregado' | null {
  if (!estadoZipnova) return null;
  if (ENTREGADO.has(estadoZipnova)) return 'entregado';
  if (CON_TRANSPORTISTA.has(estadoZipnova)) return 'con_transportista';
  return null;
}

/** Nombre en criollo del estado de Zipnova, para la ficha del pedido. */
export const NOMBRE_ESTADO: Record<string, string> = {
  new: 'Creado',
  documentation_ready: 'Etiqueta lista',
  ready_to_ship: 'Listo para retirar',
  cancelled: 'Cancelado',
  expired: 'Vencido sin despachar',
  shipped: 'Despachado',
  in_transit_to_crossdock: 'Retirado',
  admitted: 'Entregado en sucursal',
  crossdock: 'En el centro de distribución',
  received_by_carrier: 'Recibido por el correo',
  in_transit: 'En camino',
  delivery_attempt: 'Intento de entrega',
  out_for_delivery: 'En reparto',
  available_for_pickup: 'Para retirar en sucursal',
  delivered: 'Entregado',
  delivered_with_damage: 'Entregado (con daños)',
  not_delivered: 'No entregado',
  rejected: 'Rechazado por el correo',
  returned_to_seller: 'Devuelto',
  lost: 'Perdido',
  lost_in_carrier: 'Perdido por el correo',
};
