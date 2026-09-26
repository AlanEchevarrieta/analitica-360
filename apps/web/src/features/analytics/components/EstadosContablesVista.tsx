"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { SelectorPeriodo, useRangoFechas } from "@/components/shared/selector-periodo";
import { formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { useEstadosContables } from "../hooks/use-analytics";
import type { ConceptoCaja, EstadosContables } from "../types";
import { Kpi } from "./comunes";
import { CATEGORIAS_GASTO } from "./GastosPanel";
import { MovimientosFinancierosPanel, type PagoSugerido } from "./MovimientosFinancierosPanel";

const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

/** Fila de un estado: concepto a la izquierda y uno o más importes a la derecha. */
function Fila({ concepto, valores, nivel = 0, total = false, ayuda }: { concepto: ReactNode; valores: (number | null)[]; nivel?: 0 | 1 | 2; total?: boolean; ayuda?: string }) {
  return (
    <tr className={cn(total && "border-t font-semibold")}>
      <td className={cn("py-1.5 pr-2", nivel === 1 && "pl-4", nivel === 2 && "pl-8 text-muted-foreground")} title={ayuda}>
        {concepto}
      </td>
      {valores.map((v, i) => (
        <td key={i} className={cn("py-1.5 pl-2 text-right tabular-nums whitespace-nowrap", v != null && v < 0 && "text-destructive")}>
          {v == null ? "" : formatoPesos(v + 0) /* +0 evita "-$ 0" */}
        </td>
      ))}
    </tr>
  );
}

function Tabla({ columnas, children }: { columnas: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        {columnas.length > 0 && (
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th />
              {columnas.map((c) => (
                <th key={c} className="pb-1 pl-2 text-right font-normal whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Seccion({ titulo }: { titulo: string }) {
  return (
    <tr>
      <td colSpan={3} className="pt-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {titulo}
      </td>
    </tr>
  );
}

function BalanceCard({ e }: { e: EstadosContables }) {
  const a = e.balanceInicio;
  const b = e.balanceCierre;
  const par = (f: (x: typeof a) => number) => [f(a), f(b)];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado de situación patrimonial</CardTitle>
        <CardDescription>Qué tiene el negocio, qué debe y cuánto vale para los dueños.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabla columnas={[`al ${fechaCorta(a.fecha)}`, `al ${fechaCorta(b.fecha)}`]}>
          <Seccion titulo="Activo" />
          <Fila concepto={`Caja y bancos${b.activo.cajaEstimada ? " (estimada)" : ""}`} valores={par((x) => x.activo.caja)} nivel={1} />
          <Fila concepto="Créditos por ventas (señas a cobrar)" valores={par((x) => x.activo.creditosPorVentas)} nivel={1} />
          <Fila concepto="Bienes de cambio (mercadería a costo)" valores={par((x) => x.activo.bienesDeCambio)} nivel={1} />
          <Fila concepto="Activo corriente" valores={par((x) => x.activo.corriente)} total />
          <Fila concepto="Bienes de uso (valor de origen)" valores={par((x) => x.activo.bienesDeUsoOrigen)} nivel={1} />
          <Fila concepto="Amortización acumulada" valores={par((x) => -x.activo.amortizacionAcumulada)} nivel={2} />
          <Fila concepto="Activo no corriente" valores={par((x) => x.activo.noCorriente)} total />
          <Fila concepto="Total activo" valores={par((x) => x.activo.total)} total />

          <Seccion titulo="Pasivo" />
          <Fila concepto="Deudas con proveedores" valores={par((x) => x.pasivo.deudasComerciales)} nivel={1} />
          <Fila concepto="Préstamos" valores={par((x) => x.pasivo.prestamos)} nivel={1} />
          <Fila concepto="Total pasivo" valores={par((x) => x.pasivo.total)} total />

          <Seccion titulo="Patrimonio neto" />
          <Fila concepto="Aportes de los dueños" valores={par((x) => x.patrimonioNeto.aportes)} nivel={1} />
          <Fila concepto="Retiros de los dueños" valores={par((x) => -x.patrimonioNeto.retiros)} nivel={1} />
          <Fila concepto="Resultados acumulados" valores={par((x) => x.patrimonioNeto.resultadosAcumulados)} nivel={1} />
          <Fila
            concepto="Capital inicial y ajustes"
            valores={par((x) => x.patrimonioNeto.capitalInicialYAjustes)}
            nivel={1}
            ayuda="Lo que el negocio ya tenía antes de empezar a registrar, más recuentos de stock (sobrantes y faltantes) y diferencias de caja"
          />
          <Fila concepto="Total patrimonio neto" valores={par((x) => x.patrimonioNeto.total)} total />
          <Fila concepto="Pasivo + patrimonio neto" valores={par((x) => x.pasivo.total + x.patrimonioNeto.total)} total />
        </Tabla>
      </CardContent>
    </Card>
  );
}

function ResultadosCard({ e }: { e: EstadosContables }) {
  const r = e.resultados;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado de resultados</CardTitle>
        <CardDescription>
          Del {fechaCorta(e.desde)} al {fechaCorta(e.hasta)} · {r.cantidadVentas} ventas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabla columnas={[]}>
          <Fila concepto="Ventas" valores={[r.ventasBrutas]} />
          {r.devoluciones !== 0 && <Fila concepto="Devoluciones y cambios" valores={[r.devoluciones]} nivel={1} />}
          <Fila concepto="Ventas netas" valores={[r.ventasNetas]} total />
          <Fila concepto="Costo de la mercadería vendida" valores={[-r.costoMercaderia]} nivel={1} />
          <Fila concepto="Resultado bruto" valores={[r.resultadoBruto]} total />
          {r.gastosPorCategoria.map((g) => (
            <Fila key={g.categoria} concepto={`Gastos de ${(CATEGORIAS_GASTO[g.categoria] ?? g.categoria).toLowerCase()}`} valores={[-g.monto]} nivel={1} />
          ))}
          {r.perdidasMercaderia > 0 && <Fila concepto="Mermas, roturas y pérdidas de mercadería" valores={[-r.perdidasMercaderia]} nivel={1} />}
          {r.amortizaciones > 0 && <Fila concepto="Amortización de bienes de uso" valores={[-r.amortizaciones]} nivel={1} />}
          <Fila concepto={r.resultadoNeto >= 0 ? "Ganancia del período" : "Pérdida del período"} valores={[r.resultadoNeto]} total />
        </Tabla>
      </CardContent>
    </Card>
  );
}

function EvolucionCard({ e }: { e: EstadosContables }) {
  const v = e.evolucion;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución del patrimonio neto</CardTitle>
        <CardDescription>Por qué cambió lo que vale el negocio para los dueños.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabla columnas={[]}>
          <Fila concepto={`Patrimonio al ${fechaCorta(e.balanceInicio.fecha)}`} valores={[v.inicio]} total />
          <Fila concepto="Aportes de los dueños" valores={[v.aportes]} nivel={1} />
          <Fila concepto="Retiros / dividendos" valores={[-v.retiros]} nivel={1} />
          <Fila concepto="Resultado del período" valores={[v.resultado]} nivel={1} />
          <Fila
            concepto="Ajustes (stock, arqueos, valuación)"
            valores={[v.ajustes]}
            nivel={1}
            ayuda="Roturas y recuentos de stock, diferencias de caja en los arqueos y cambios de costo de la mercadería"
          />
          <Fila concepto={`Patrimonio al ${fechaCorta(e.hasta)}`} valores={[v.cierre]} total />
        </Tabla>
        <p className="mt-3 text-xs text-muted-foreground">No se registran reservas: en un negocio chico la ganancia queda en resultados acumulados hasta que los dueños la retiran.</p>
      </CardContent>
    </Card>
  );
}

const CONCEPTOS_CAJA: Record<ConceptoCaja, string> = {
  cobros_ventas: "Cobros de ventas",
  devoluciones: "Devoluciones a clientes",
  pagos_compras: "Compras pagadas al contado",
  pagos_proveedores: "Pagos a proveedores",
  gastos: "Gastos pagados",
  bienes_uso: "Compra de bienes de uso",
  aportes: "Aportes de los dueños",
  retiros: "Retiros de los dueños",
  prestamos_recibidos: "Préstamos recibidos",
  prestamos_pagados: "Pagos de préstamos",
};

function FlujoCard({ e }: { e: EstadosContables }) {
  const f = e.flujo;
  const bloque = (actividad: "operativa" | "inversion" | "financiacion", titulo: string, total: number) => (
    <>
      <Seccion titulo={titulo} />
      {f.lineas
        .filter((l) => l.actividad === actividad)
        .map((l) => (
          <Fila key={l.concepto} concepto={CONCEPTOS_CAJA[l.concepto]} valores={[l.monto]} nivel={1} />
        ))}
      <Fila concepto={`Total ${titulo.toLowerCase()}`} valores={[total]} total />
    </>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado de flujo de efectivo</CardTitle>
        <CardDescription>De dónde vino y a dónde fue la plata en el período.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabla columnas={[]}>
          <Fila concepto={`Plata al ${fechaCorta(e.balanceInicio.fecha)}`} valores={[f.saldoInicial]} total />
          {bloque("operativa", "Actividades operativas", f.operativas)}
          {bloque("inversion", "Actividades de inversión", f.inversion)}
          {bloque("financiacion", "Actividades de financiación", f.financiacion)}
          {f.diferenciasArqueo !== 0 && <Fila concepto="Diferencias de caja (arqueos)" valores={[f.diferenciasArqueo]} total />}
          <Fila concepto={`Plata al ${fechaCorta(e.hasta)}`} valores={[f.saldoFinal]} total />
        </Tabla>
      </CardContent>
    </Card>
  );
}

const veces = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("es-AR")}×`);

export function EstadosContablesVista() {
  const periodo = useRangoFechas("mes");
  const { desde, hasta } = periodo;
  const { data: e, isPending, isError, error, refetch } = useEstadosContables(desde, hasta);
  const [pagoSugerido, setPagoSugerido] = useState<PagoSugerido | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <SelectorPeriodo periodo={periodo} />
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer aria-hidden /> Imprimir / PDF
        </Button>
      </div>
      {isPending ? (
        <CargandoFilas filas={10} />
      ) : isError ? (
        <ErrorDatos error={error} onReintentar={() => refetch()} />
      ) : (
        <>
          {e.notas.avisos.length > 0 && (
            <div role="note" className="flex flex-col gap-1.5 rounded-xl bg-amber-500/10 p-4 text-sm ring-1 ring-amber-500/30 print:hidden">
              {e.notas.avisos.map((a) => (
                <p key={a} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
                  {a}
                </p>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi titulo="Liquidez" valor={veces(e.indicadores.liquidez)} detalle={e.indicadores.liquidez == null ? "Sin deudas: no aplica" : "Activo corriente por cada $1 de deuda"} />
            <Kpi titulo="Prueba ácida" valor={veces(e.indicadores.pruebaAcida)} detalle="Igual, sin contar la mercadería" />
            <Kpi titulo="Endeudamiento" valor={veces(e.indicadores.endeudamiento)} detalle="Deuda por cada $1 de patrimonio" />
            <Kpi
              titulo="Rentabilidad del patrimonio"
              valor={e.indicadores.rentabilidadPatrimonioPct == null ? "—" : `${e.indicadores.rentabilidadPatrimonioPct.toLocaleString("es-AR")}%`}
              detalle="Ganancia del período sobre lo que vale el negocio"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <BalanceCard e={e} />
            <div className="flex flex-col gap-4">
              <ResultadosCard e={e} />
              <EvolucionCard e={e} />
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <FlujoCard e={e} />
            <Card>
              <CardHeader>
                <CardTitle>Deudas con proveedores</CardTitle>
                <CardDescription>Compras hechas a crédito que todavía no se pagaron.</CardDescription>
              </CardHeader>
              <CardContent>
                {e.deudaPorProveedor.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No le debés a ningún proveedor.</p>
                ) : (
                  <ul className="flex flex-col divide-y text-sm">
                    {e.deudaPorProveedor.map((d) => (
                      <li key={`${d.proveedorId}-${d.nombre}`} className="flex items-center gap-3 py-2">
                        <span className="flex-1 truncate">{d.nombre}</span>
                        <span className="font-medium tabular-nums">{formatoPesos(d.saldo)}</span>
                        <Button size="sm" variant="outline" className="print:hidden" onClick={() => {
                            setPagoSugerido({ proveedorId: d.proveedorId, monto: d.saldo });
                            document.getElementById("movimientos-financieros")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}>
                          Pagar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div id="movimientos-financieros" className="scroll-mt-4 print:hidden">
            <MovimientosFinancierosPanel desde={desde} hasta={hasta} pagoSugerido={pagoSugerido} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Notas y criterios</CardTitle>
              <CardDescription>Cómo se armaron estos estados (lo que le sirve a tu contador).</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                {e.notas.criterios.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
