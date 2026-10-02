"use client";

import Link from "next/link";
import { formatoPesos } from "@/lib/formato";
import { pct, useResumenAlianzas } from "../../hooks/use-alianzas";
import { Panel } from "../comunes";

/** Alianzas en el resumen de la consola: clientes y conversión por cámara, comisión y descuentos. */
export function ResumenAlianzasPanel() {
  const { data: r } = useResumenAlianzas();
  if (!r || r.porCamara.length === 0) return null;
  const proximos = r.estimadoProximosMeses.reduce((a, m) => a + m.monto, 0);
  return (
    <Panel
      titulo="Alianzas"
      descripcion="Clientes que llegaron por cámaras y lo que les corresponde"
      accion={
        <Link href="/admin/alianzas" className="text-sm text-primary hover:underline">
          Ver todo →
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ul className="flex flex-col gap-1.5 text-sm">
          {r.porCamara.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <Link href={`/admin/alianzas/${c.id}`} className="truncate font-medium hover:underline">
                {c.nombre}
              </Link>
              <span className="text-muted-foreground tabular-nums">
                {c.registros} llegaron · {c.pagan} pagan ({pct(c.conversion)})
              </span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Comisión de este mes</dt>
          <dd className="text-right font-medium tabular-nums">{formatoPesos(r.comisionMes)}</dd>
          <dt className="text-muted-foreground">Aprobada sin pagar</dt>
          <dd className="text-right font-medium tabular-nums">{formatoPesos(r.aprobadasSinPagar)}</dd>
          <dt className="text-muted-foreground">Estimada próximos 6 meses</dt>
          <dd className="text-right font-medium tabular-nums">{formatoPesos(proximos)}</dd>
          <dt className="text-muted-foreground">Descuentos por cupones</dt>
          <dd className="text-right font-medium tabular-nums">{formatoPesos(r.descuentosOtorgados)}</dd>
        </dl>
      </div>
    </Panel>
  );
}
