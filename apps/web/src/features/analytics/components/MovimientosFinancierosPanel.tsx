"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SinDatos } from "@/components/shared/estado-datos";
import { useRol } from "@/hooks/use-rol";
import { formatoPesos } from "@/lib/formato";
import { aNumero } from "@/lib/numeros";
import { hoyAR } from "@/lib/periodos";
import { useProveedores } from "@/features/compras/hooks/use-compras";
import { useAccionesMovimientos, useMovimientosFinancieros } from "../hooks/use-analytics";
import type { TipoMovimientoFinanciero } from "../types";

export const TIPOS_MOVIMIENTO: Record<TipoMovimientoFinanciero, { nombre: string; ayuda: string }> = {
  arqueo: { nombre: "Arqueo de caja", ayuda: "Contá toda la plata del negocio ese día (efectivo + banco + Mercado Pago). Desde ahí la caja se calcula exacta." },
  aporte: { nombre: "Aporte de los dueños", ayuda: "Plata que pusieron los dueños en el negocio (por ejemplo, para comprar mercadería)." },
  retiro: { nombre: "Retiro de los dueños", ayuda: "Plata que se llevaron los dueños (sueldo propio, ganancias, dividendos)." },
  prestamo_recibido: { nombre: "Préstamo recibido", ayuda: "Plata que te prestó un banco o una persona. Queda como deuda." },
  prestamo_pago: { nombre: "Pago de préstamo", ayuda: "Lo que devolviste del préstamo (solo el capital; los intereses cargalos como gasto)." },
  bien_uso: { nombre: "Bien de uso", ayuda: "Algo que usa el negocio y dura años: computadora, heladera, estantería, vehículo." },
  pago_proveedor: { nombre: "Pago a proveedor", ayuda: "Lo que le pagaste a un proveedor por compras que hiciste a crédito." },
};

const VIDA_UTIL = [
  { meses: 36, etiqueta: "3 años (computadoras, celulares)" },
  { meses: 60, etiqueta: "5 años (vehículos, máquinas)" },
  { meses: 120, etiqueta: "10 años (muebles, instalaciones)" },
  { meses: 0, etiqueta: "No se desgasta (terreno)" },
];

const fechaCorta = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";

export interface PagoSugerido {
  proveedorId: string | null;
  monto: number;
}

export function MovimientosFinancierosPanel({ desde, hasta, pagoSugerido }: { desde: string; hasta: string; pagoSugerido?: PagoSugerido | null }) {
  const esDueno = useRol() === "dueno";
  const movimientos = useMovimientosFinancieros(desde, hasta);
  const proveedores = useProveedores();
  const { crear, anular } = useAccionesMovimientos();
  const [m, setM] = useState({
    tipo: "arqueo" as TipoMovimientoFinanciero,
    monto: "",
    fecha: hoyAR(),
    descripcion: "",
    proveedorId: "",
    vidaUtilMeses: 36,
    conCaja: true,
  });
  const [sugeridoAplicado, setSugeridoAplicado] = useState<PagoSugerido | null>(null);
  // "Pagar" desde la deuda con un proveedor: precarga el formulario una vez por pedido.
  if (pagoSugerido && pagoSugerido !== sugeridoAplicado) {
    setSugeridoAplicado(pagoSugerido);
    setM((x) => ({ ...x, tipo: "pago_proveedor", proveedorId: pagoSugerido.proveedorId ?? "", monto: String(pagoSugerido.monto) }));
  }

  function agregar() {
    const monto = aNumero(m.monto);
    if (m.tipo === "arqueo" ? monto < 0 || m.monto.trim() === "" : monto <= 0) return toast.error("Completá el monto.");
    crear.mutate(
      {
        tipo: m.tipo,
        monto,
        fecha: m.fecha,
        descripcion: m.descripcion.trim(),
        proveedorId: m.tipo === "pago_proveedor" && m.proveedorId ? m.proveedorId : null,
        vidaUtilMeses: m.tipo === "bien_uso" && m.vidaUtilMeses > 0 ? m.vidaUtilMeses : null,
        conCaja: m.tipo === "bien_uso" ? m.conCaja : true,
      },
      {
        onSuccess: () => {
          toast.success(`${TIPOS_MOVIMIENTO[m.tipo].nombre} registrado`);
          setM((x) => ({ ...x, monto: "", descripcion: "" }));
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
      },
    );
  }

  const lista = movimientos.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Movimientos de plata y patrimonio</CardTitle>
        <CardDescription>
          Lo que no es venta, compra ni gasto: aportes y retiros de los dueños, préstamos, bienes de uso, pagos a proveedores y arqueos de caja. Con esto el balance y
          el flujo de fondos quedan completos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {esDueno && (
          <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <select className={selectClase} aria-label="Tipo de movimiento" value={m.tipo} onChange={(e) => setM({ ...m, tipo: e.target.value as TipoMovimientoFinanciero })}>
                {Object.entries(TIPOS_MOVIMIENTO).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t.nombre}
                  </option>
                ))}
              </select>
              {m.tipo === "pago_proveedor" && (
                <select className={selectClase} aria-label="Proveedor" value={m.proveedorId} onChange={(e) => setM({ ...m, proveedorId: e.target.value })}>
                  <option value="">Proveedor…</option>
                  {(proveedores.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              )}
              <Input
                className="min-w-40 flex-1"
                placeholder={m.tipo === "bien_uso" ? "Qué es (ej. Notebook)" : "Detalle (opcional)"}
                aria-label="Detalle"
                value={m.descripcion}
                onChange={(e) => setM({ ...m, descripcion: e.target.value })}
              />
              <Input
                className="w-36"
                inputMode="decimal"
                placeholder={m.tipo === "arqueo" ? "Plata contada" : "Monto"}
                aria-label="Monto"
                value={m.monto}
                onChange={(e) => setM({ ...m, monto: e.target.value })}
              />
              <Input className="w-40" type="date" aria-label="Fecha" value={m.fecha} onChange={(e) => setM({ ...m, fecha: e.target.value })} />
              <Button onClick={agregar} disabled={crear.isPending}>
                Registrar
              </Button>
            </div>
            {m.tipo === "bien_uso" && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  Dura
                  <select className={selectClase} value={m.vidaUtilMeses} onChange={(e) => setM({ ...m, vidaUtilMeses: Number(e.target.value) })}>
                    {VIDA_UTIL.map((v) => (
                      <option key={v.meses} value={v.meses}>
                        {v.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!m.conCaja} onChange={(e) => setM({ ...m, conCaja: !e.target.checked })} />
                  Ya era de los dueños (no se pagó con plata del negocio)
                </label>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{TIPOS_MOVIMIENTO[m.tipo].ayuda}</p>
          </div>
        )}

        {lista.length === 0 ? (
          <SinDatos mensaje="No hay movimientos en este período." />
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {lista.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2">
                <span className="w-24 tabular-nums text-muted-foreground">{fechaCorta(x.fecha)}</span>
                <span className="w-40 text-muted-foreground">{TIPOS_MOVIMIENTO[x.tipo]?.nombre ?? x.tipo}</span>
                <span className="flex-1 truncate">
                  {x.descripcion}
                  {x.proveedorNombre && <span className="text-muted-foreground"> · {x.proveedorNombre}</span>}
                  {x.tipo === "bien_uso" && (
                    <span className="ml-2 rounded bg-muted px-1.5 text-xs">
                      {x.vidaUtilMeses ? `${Math.round(x.vidaUtilMeses / 12)} años` : "sin amortizar"}
                      {!x.conCaja && " · aporte"}
                    </span>
                  )}
                </span>
                <span className="font-medium tabular-nums">{formatoPesos(x.monto)}</span>
                {esDueno && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Anular ${x.descripcion}`}
                    onClick={() => {
                      if (window.confirm(`¿Anular "${x.descripcion}"?`)) anular.mutate(x.id, { onSuccess: () => toast.success("Movimiento anulado") });
                    }}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
