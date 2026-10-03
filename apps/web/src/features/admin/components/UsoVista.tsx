"use client";

import { useState } from "react";
import Link from "next/link";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoFechaHora, formatoNumero } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { useEmpresasAdmin } from "../hooks/use-admin";
import { nombrePantalla, useResumenUso, type FiltrosUso } from "../hooks/use-uso";
import { Indicador, Panel } from "./comunes";

const G_DIAS = {
  vistas: { label: "Pantallas abiertas", color: "var(--chart-2)" },
  clics: { label: "Clics", color: "var(--chart-4)" },
  usuarios: { label: "Usuarios", color: "var(--chart-1)" },
} satisfies ChartConfig;
const PERIODOS: { dias: FiltrosUso["dias"]; etiqueta: string }[] = [
  { dias: 1, etiqueta: "Hoy" },
  { dias: 7, etiqueta: "7 días" },
  { dias: 30, etiqueta: "30 días" },
  { dias: 90, etiqueta: "90 días" },
];
const diaCorto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Barra proporcional detrás del número: se ve de un vistazo qué pesa más. */
function Barra({ valor, max }: { valor: number; max: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary/70" style={{ width: `${max ? Math.max(4, (valor / max) * 100) : 0}%` }} />
    </div>
  );
}

/** Consola → Uso: qué pantallas abren y qué tocan los usuarios. */
export function UsoVista() {
  const [f, setF] = useState<FiltrosUso>({ dias: 30, empresaId: "", conAdmins: false });
  const { data, isPending, isError, error, refetch, isFetching } = useResumenUso(f);
  const empresas = useEmpresasAdmin();

  const filtros = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg border p-1">
        {PERIODOS.map((p) => (
          <button
            key={p.dias}
            type="button"
            onClick={() => setF((v) => ({ ...v, dias: p.dias }))}
            className={cn("rounded-md px-2.5 py-1 text-sm", f.dias === p.dias ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>
      <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" aria-label="Empresa" value={f.empresaId} onChange={(e) => setF((v) => ({ ...v, empresaId: e.target.value }))}>
        <option value="">Todas las empresas</option>
        {(empresas.data ?? []).map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={f.conAdmins} onChange={(e) => setF((v) => ({ ...v, conAdmins: e.target.checked }))} />
        Incluirme (administradores)
      </label>
    </div>
  );

  if (isPending) return <div className="flex flex-col gap-4">{filtros}<CargandoFilas filas={8} /></div>;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  const t = data.totales;
  const maxPantalla = data.pantallas[0]?.vistas ?? 0;
  const maxClic = data.clics[0]?.veces ?? 0;

  return (
    <div className={cn("flex flex-col gap-4", isFetching && "opacity-70 transition-opacity")}>
      {filtros}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicador etiqueta="Usuarios activos" valor={formatoNumero(t.usuarios)} detalle={`de ${formatoNumero(t.empresas)} ${t.empresas === 1 ? "empresa" : "empresas"}`} />
        <Indicador etiqueta="Sesiones" valor={formatoNumero(t.sesiones)} detalle={t.usuarios ? `${(t.sesiones / t.usuarios).toFixed(1)} por usuario` : undefined} />
        <Indicador etiqueta="Pantallas abiertas" valor={formatoNumero(t.vistas)} detalle={t.sesiones ? `${(t.vistas / t.sesiones).toFixed(1)} por sesión` : undefined} />
        <Indicador etiqueta="Clics" valor={formatoNumero(t.clics)} />
        <Indicador
          etiqueta="Dispositivos"
          valor={data.dispositivos.length ? data.dispositivos.map((d) => `${d.dispositivo === "celular" ? "📱" : "💻"} ${d.usuarios}`).join("  ") : "—"}
          detalle="usuarios por dispositivo"
        />
      </div>

      {t.vistas + t.clics === 0 ? (
        <SinDatos mensaje="Todavía no hay uso registrado en este período. Se empieza a registrar desde que se publicó esta función." />
      ) : (
        <>
          <Panel titulo="Uso por día" descripcion="Pantallas abiertas, clics y usuarios distintos cada día">
            <div className="h-56">
              <ChartContainer config={G_DIAS} className="aspect-auto h-full w-full">
                <ComposedChart data={data.porDia} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="dia" tickFormatter={diaCorto} tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis yAxisId="e" tickLine={false} axisLine={false} fontSize={12} width={40} />
                  <YAxis yAxisId="u" orientation="right" tickLine={false} axisLine={false} fontSize={12} width={30} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(l) => diaCorto(String(l))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar yAxisId="e" dataKey="vistas" stackId="a" fill="var(--color-vistas)" />
                  <Bar yAxisId="e" dataKey="clics" stackId="a" fill="var(--color-clics)" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="u" dataKey="usuarios" stroke="var(--color-usuarios)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ChartContainer>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel titulo="Pantallas más usadas" descripcion="Cuántas veces se abrieron y cuántos usuarios distintos">
              <ul className="flex flex-col gap-2.5">
                {data.pantallas.slice(0, 15).map((p) => (
                  <li key={p.ruta} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate" title={p.ruta}>{nombrePantalla(p.ruta)}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        <b className="text-foreground">{formatoNumero(p.vistas)}</b> · {p.usuarios} {p.usuarios === 1 ? "usuario" : "usuarios"}
                      </span>
                    </div>
                    <Barra valor={p.vistas} max={maxPantalla} />
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel titulo="Lo que más tocan" descripcion="Botones y enlaces, con la pantalla donde está cada uno">
              <ul className="flex flex-col gap-2.5">
                {data.clics.slice(0, 15).map((c) => (
                  <li key={`${c.ruta}|${c.objetivo}`} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        {c.objetivo} <span className="text-xs text-muted-foreground">en {nombrePantalla(c.ruta)}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        <b className="text-foreground">{formatoNumero(c.veces)}</b> · {c.usuarios} {c.usuarios === 1 ? "usuario" : "usuarios"}
                      </span>
                    </div>
                    <Barra valor={c.veces} max={maxClic} />
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel titulo="Usuarios" descripcion="Quién usa la app y cuánto. Tocá uno para ver qué hizo.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="hidden md:table-cell">Empresa</TableHead>
                  <TableHead className="text-right">Pantallas</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Clics</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Sesiones</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Días activo</TableHead>
                  <TableHead className="hidden md:table-cell">Último uso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.usuarios.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="whitespace-normal">
                      <Link href={`/admin/uso/usuarios/${u.id}?dias=${f.dias}`} className="font-medium hover:underline">
                        {u.nombre || u.email}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {u.email}
                        <span className="md:hidden"> · {u.empresa}</span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{u.empresa}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatoNumero(u.vistas)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatoNumero(u.clics)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatoNumero(u.sesiones)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">{u.dias}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground md:table-cell">
                      {formatoFechaHora(u.ultima)} {u.dispositivo === "celular" ? "📱" : u.dispositivo === "escritorio" ? "💻" : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </>
      )}
    </div>
  );
}
