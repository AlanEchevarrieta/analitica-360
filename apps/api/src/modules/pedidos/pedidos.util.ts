import type { EstadoPedido } from './pedidos.repository.js';

/** Puerto de src/lib/pedidos.ts::itemPickingCompleto. */
export function itemPickingCompleto(item: { cantidad: number; cantidadPreparada: number }): boolean {
  return item.cantidadPreparada === item.cantidad && item.cantidad > 0;
}

const ESTADOS_BLOQUEADOS: EstadoPedido[] = ['despachado', 'con_transportista', 'entregado', 'cancelado'];

/**
 * Puerto de src/lib/pedidos.ts::sincronizarEstadoPicking - a partir de cómo
 * viene el picking de los items, resuelve a qué estado le corresponde estar
 * al pedido (nunca avanza más allá de 'listo_despacho' automáticamente; para
 * eso está confirmarListoDespacho(), que además fuerza los items pendientes).
 */
export function siguienteEstadoPicking(
  estadoActual: EstadoPedido,
  items: { cantidad: number; cantidadPreparada: number; preparado: boolean }[],
): EstadoPedido {
  if (ESTADOS_BLOQUEADOS.includes(estadoActual)) return estadoActual;
  const todos = items.length > 0 && items.every(itemPickingCompleto);
  const alguno = items.some((i) => i.cantidadPreparada > 0 || i.preparado);
  if (estadoActual === 'listo_despacho') {
    return todos ? 'listo_despacho' : alguno ? 'en_preparacion' : 'nuevo';
  }
  return alguno ? 'en_preparacion' : 'nuevo';
}
