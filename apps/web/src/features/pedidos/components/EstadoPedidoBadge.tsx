import { ESTADOS, type EstadoPedido } from "../types";

export function EstadoPedidoBadge({ estado }: { estado: EstadoPedido }) {
  const e = ESTADOS.find((x) => x.valor === estado);
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${e?.color ?? ""}`}>
      {e?.etiqueta ?? estado}
    </span>
  );
}
