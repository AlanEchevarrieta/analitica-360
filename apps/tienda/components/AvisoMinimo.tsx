"use client";

import { formatoARS } from "@/lib/productos";
import { useSitio } from "@/lib/sitio-contexto";

/** Cuánto falta para la compra mínima del negocio (0 si no hay mínimo o ya se alcanzó). */
export function useFaltaMinimo(total: number) {
  const { pedidoMinimo } = useSitio();
  return pedidoMinimo && total < pedidoMinimo ? pedidoMinimo - total : 0;
}

export function AvisoMinimo({ total }: { total: number }) {
  const { pedidoMinimo } = useSitio();
  const falta = useFaltaMinimo(total);
  if (!falta || !pedidoMinimo) return null;
  return (
    <p role="status" className="rounded-xl bg-[var(--marca)]/10 px-3 py-2 text-sm text-[var(--marca-oscuro)]">
      La compra mínima es de <b>{formatoARS(pedidoMinimo)}</b>. Te faltan {formatoARS(falta)}.
    </p>
  );
}
