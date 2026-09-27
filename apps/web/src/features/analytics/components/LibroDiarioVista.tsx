"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { SelectorPeriodo, useRangoFechas } from "@/components/shared/selector-periodo";
import { useApiFetch } from "@/hooks/use-api";
import { descargarCsv } from "@/lib/csv";
import { formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";

interface Linea {
  cuenta: string;
  nombre: string;
  debe: number;
  haber: number;
}
interface Asiento {
  numero: number;
  fecha: string;
  concepto: string;
  origen: string;
  lineas: Linea[];
}
interface CuentaMayor {
  cuenta: string;
  nombre: string;
  tipo: "activo" | "pasivo" | "patrimonio" | "resultado";
  debe: number;
  haber: number;
  saldo: number;
  movimientos: number;
}
interface Libro {
  desde: string;
  hasta: string;
  asientos: Asiento[];
  mayor: CuentaMayor[];
  totales: { debe: number; haber: number };
}

const ORIGENES = [
  { valor: "", etiqueta: "Todas las operaciones" },
  { valor: "venta", etiqueta: "Ventas" },
  { valor: "cobro", etiqueta: "Cobros de saldos" },
  { valor: "devolucion", etiqueta: "Devoluciones" },
  { valor: "compra", etiqueta: "Compras" },
  { valor: "pago_proveedor", etiqueta: "Pagos a proveedores" },
  { valor: "gasto", etiqueta: "Gastos" },
  { valor: "movimiento", etiqueta: "Aportes, retiros, préstamos y bienes de uso" },
  { valor: "perdida", etiqueta: "Mermas y roturas" },
  { valor: "amortizacion", etiqueta: "Amortizaciones" },
];
const TIPOS: Record<CuentaMayor["tipo"], string> = { activo: "Activo", pasivo: "Pasivo", patrimonio: "Patrimonio neto", resultado: "Resultados" };
const POR_PAGINA = 60;
const fecha = (iso: string) => iso.split("-").reverse().join("/");
const monto = (n: number) => (n ? formatoPesos(n) : "");

/** Libro diario y mayor del período, armados solos a partir de lo que se carga. */
export function LibroDiarioVista() {
  const periodo = useRangoFechas("mes");
  const api = useApiFetch();
  const { orgId } = useAuth();
  const [vista, setVista] = useState<"diario" | "mayor">("diario");
  const [origen, setOrigen] = useState("");
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["libro-diario", orgId, periodo.desde, periodo.hasta],
    queryFn: () => api<Libro>(`/libro-diario?desde=${periodo.desde}&hasta=${periodo.hasta}`),
    enabled: Boolean(orgId),
    placeholderData: (previo) => previo,
  });

  const asientos = (data?.asientos ?? []).filter((a) => !origen || a.origen === origen);

  function exportar() {
    if (!data) return;
    if (vista === "diario") {
      descargarCsv(
        `libro-diario-${data.desde}-a-${data.hasta}`,
        data.asientos.flatMap((a) => a.lineas.map((l) => ({ Asiento: a.numero, Fecha: fecha(a.fecha), Concepto: a.concepto, Cuenta: l.nombre, Debe: l.debe || "", Haber: l.haber || "" }))),
      );
    } else {
      descargarCsv(
        `libro-mayor-${data.desde}-a-${data.hasta}`,
        data.mayor.map((m) => ({ Cuenta: m.nombre, Tipo: TIPOS[m.tipo], Debe: m.debe, Haber: m.haber, "Saldo del período": m.saldo, Movimientos: m.movimientos })),
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SelectorPeriodo periodo={periodo} />
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1" role="group" aria-label="Libro">
            {(["diario", "mayor"] as const).map((v) => (
              <Button key={v} size="sm" variant={vista === v ? "secondary" : "ghost"} aria-pressed={vista === v} onClick={() => setVista(v)}>
                {v === "diario" ? "Libro diario" : "Libro mayor"}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={exportar} disabled={!data}>
            <Download aria-hidden /> Exportar
          </Button>
        </div>
      </div>

      {isPending ? (
        <CargandoFilas filas={8} />
      ) : isError ? (
        <ErrorDatos error={error} onReintentar={() => refetch()} />
      ) : data.asientos.length === 0 ? (
        <SinDatos mensaje="No hay operaciones en este período." />
      ) : vista === "mayor" ? (
        <Card className={cn(isFetching && "opacity-60")}>
          <CardHeader>
            <CardTitle>Libro mayor</CardTitle>
            <CardDescription>Cuánto se movió cada cuenta en el período (debe − haber). No incluye los saldos que venían de antes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Debe</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Haber</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.mayor.map((m, i) => (
                  <TableRow key={m.cuenta} className={cn(i > 0 && data.mayor[i - 1].tipo !== m.tipo && "border-t-2")}>
                    <TableCell>
                      <span className="font-medium">{m.nombre}</span>
                      <span className="block text-xs text-muted-foreground">
                        {TIPOS[m.tipo]} · {m.movimientos} {m.movimientos === 1 ? "movimiento" : "movimientos"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{monto(m.debe)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{monto(m.haber)}</TableCell>
                    <TableCell className={cn("text-right font-medium tabular-nums", m.saldo < 0 && "text-muted-foreground")}>
                      {formatoPesos(Math.abs(m.saldo))} {m.saldo > 0 ? "D" : m.saldo < 0 ? "H" : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">D = saldo deudor · H = saldo acreedor. La suma de todos los saldos da cero (partida doble).</p>
          </CardContent>
        </Card>
      ) : (
        <Card className={cn(isFetching && "opacity-60")}>
          <CardHeader className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Libro diario</CardTitle>
              <CardDescription>
                {data.asientos.length} asientos · Debe {formatoPesos(data.totales.debe)} = Haber {formatoPesos(data.totales.haber)}. Las ventas y las mermas se asientan por día; el resto, por operación.
              </CardDescription>
            </div>
            <select aria-label="Tipo de operación" className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={origen} onChange={(e) => (setOrigen(e.target.value), setMostrar(POR_PAGINA))}>
              {ORIGENES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Fecha</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                  <TableHead className="text-right">Haber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asientos.slice(0, mostrar).flatMap((a) => [
                  <TableRow key={`a${a.numero}`} className="border-t-2 bg-muted/30">
                    <TableCell className="tabular-nums text-muted-foreground">{fecha(a.fecha)}</TableCell>
                    <TableCell colSpan={3} className="font-medium">
                      <span className="mr-2 text-xs text-muted-foreground">#{a.numero}</span>
                      {a.concepto}
                    </TableCell>
                  </TableRow>,
                  ...a.lineas.map((l, i) => (
                    <TableRow key={`a${a.numero}-${i}`} className="border-0">
                      <TableCell />
                      <TableCell className={cn(l.haber > 0 && "pl-10 text-muted-foreground")}>{l.haber > 0 ? `a ${l.nombre}` : l.nombre}</TableCell>
                      <TableCell className="text-right tabular-nums">{monto(l.debe)}</TableCell>
                      <TableCell className="text-right tabular-nums">{monto(l.haber)}</TableCell>
                    </TableRow>
                  )),
                ])}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                {Math.min(mostrar, asientos.length)} de {asientos.length} asientos
              </span>
              {mostrar < asientos.length && (
                <Button size="sm" variant="outline" onClick={() => setMostrar((m) => m + POR_PAGINA)}>
                  Ver más
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
