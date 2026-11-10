"use client";

import { useState } from "react";
import { CalendarOff, Pencil, TrendingUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputPlata } from "@/components/shared/input-plata";
import { SinDatos } from "@/components/shared/estado-datos";
import { formatoPesos } from "@/lib/formato";
import { aNumero } from "@/lib/numeros";
import { hoyAR } from "@/lib/periodos";
import { vecesEnPeriodo } from "../gastos-recurrentes";
import { useAccionesGastos, useGastos } from "../hooks/use-analytics";
import type { Gasto } from "../types";

export const CATEGORIAS_GASTO: Record<string, string> = {
  alquiler: "Alquiler",
  sueldos: "Sueldos",
  servicios: "Servicios",
  marketing: "Marketing",
  logistica: "Logística",
  impuestos: "Impuestos",
  mantenimiento: "Mantenimiento",
  otro: "Otro",
};
const FRECUENCIAS = { mensual: "Mensual", quincenal: "Quincenal", semanal: "Semanal" } as const;
const fechaCorta = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export function GastosPanel({ desde, hasta }: { desde: string; hasta: string }) {
  const gastos = useGastos("2000-01-01", hasta);
  const lista = (gastos.data ?? []).filter(
    (x) => (x.fecha.slice(0, 10) >= desde || x.recurrente) && (!x.fechaFin || x.fechaFin.slice(0, 10) >= desde),
  );
  const { crear, editar, dejarDeRepetir, cambiarMontoDesde, anular, cambiarTipo } = useAccionesGastos();
  const [g, setG] = useState({
    categoria: "alquiler",
    descripcion: "",
    monto: "",
    fecha: hoyAR(),
    frecuencia: "" as "" | keyof typeof FRECUENCIAS,
    tipoCosto: "" as "" | "fijo" | "variable",
  });
  const [accionActiva, setAccionActiva] = useState<
    | { tipo: "editar"; gasto: Gasto; categoria: string; descripcion: string; monto: string; fecha: string }
    | { tipo: "cambiar-monto"; gasto: Gasto; desde: string; monto: string }
    | { tipo: "dejar-repetir"; gasto: Gasto; desde: string }
    | null
  >(null);

  const tipoElegido = g.tipoCosto || (g.frecuencia ? "fijo" : "variable");

  function agregar() {
    const montoNum = aNumero(g.monto);
    if (!g.descripcion.trim() || montoNum <= 0) return toast.error("Completá descripción y monto.");
    if (g.frecuencia) {
      const duplicado = (gastos.data ?? []).find(
        (x) =>
          x.recurrente &&
          x.categoria === g.categoria &&
          x.monto === montoNum &&
          (!x.fechaFin || x.fechaFin.slice(0, 10) >= g.fecha),
      );
      if (duplicado) {
        const freqTexto = duplicado.frecuencia ? FRECUENCIAS[duplicado.frecuencia].toLowerCase() : "recurrente";
        const cambiarFecha = window.confirm(
          `Ya tenés «${duplicado.descripcion}» ${freqTexto} desde el ${fechaCorta(duplicado.fecha)}. ¿Querés cambiarle la fecha de inicio en vez de cargar otro?`,
        );
        if (cambiarFecha) {
          editar.mutate(
            { id: duplicado.id, fecha: g.fecha },
            {
              onSuccess: () => {
                toast.success("Fecha de inicio actualizada");
                setG((x) => ({ ...x, descripcion: "", monto: "", tipoCosto: "" }));
              },
              onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
            },
          );
          return;
        }
      }
    }
    crear.mutate(
      {
        categoria: g.categoria,
        descripcion: g.descripcion.trim(),
        monto: montoNum,
        fecha: g.fecha,
        recurrente: Boolean(g.frecuencia),
        frecuencia: g.frecuencia || null,
        tipoCosto: tipoElegido,
      },
      {
        onSuccess: () => {
          toast.success("Gasto cargado");
          setG((x) => ({ ...x, descripcion: "", monto: "", tipoCosto: "" }));
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo cargar"),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos del negocio</CardTitle>
        <CardDescription>
          Alquiler, sueldos, servicios… Los recurrentes se cuentan solos en cada período según su frecuencia. <strong>Fijo</strong> = lo pagás vendas o no (alquiler, sueldos); <strong>variable</strong> = depende de lo que vendés (comisiones, envíos). Con eso se calcula tu punto de equilibrio.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" aria-label="Categoría" value={g.categoria} onChange={(e) => setG({ ...g, categoria: e.target.value })}>
            {Object.entries(CATEGORIAS_GASTO).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <Input className="min-w-48 flex-1" placeholder="Descripción" aria-label="Descripción" value={g.descripcion} onChange={(e) => setG({ ...g, descripcion: e.target.value })} />
          <InputPlata className="w-32" placeholder="Monto" aria-label="Monto" value={g.monto} onChange={(e) => setG({ ...g, monto: e.target.value })} />
          <Input className="w-40" type="date" aria-label="Fecha" value={g.fecha} onChange={(e) => setG({ ...g, fecha: e.target.value })} />
          <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" aria-label="Se repite" value={g.frecuencia} onChange={(e) => setG({ ...g, frecuencia: e.target.value as typeof g.frecuencia })}>
            <option value="">Una sola vez</option>
            {Object.entries(FRECUENCIAS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" aria-label="Fijo o variable" value={tipoElegido} onChange={(e) => setG({ ...g, tipoCosto: e.target.value as "fijo" | "variable" })}>
            <option value="fijo">Fijo</option>
            <option value="variable">Variable</option>
          </select>
          <Button onClick={agregar} disabled={crear.isPending || editar.isPending}>Agregar</Button>
        </div>

        {accionActiva && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            {accionActiva.tipo === "editar" && (
              <>
                <span className="font-medium">Editar gasto (corrige toda la historia):</span>
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" value={accionActiva.categoria} onChange={(e) => setAccionActiva({ ...accionActiva, categoria: e.target.value })}>
                  {Object.entries(CATEGORIAS_GASTO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <Input className="w-44" value={accionActiva.descripcion} onChange={(e) => setAccionActiva({ ...accionActiva, descripcion: e.target.value })} />
                <InputPlata className="w-28" value={accionActiva.monto} onChange={(e) => setAccionActiva({ ...accionActiva, monto: e.target.value })} />
                <Input className="w-36" type="date" value={accionActiva.fecha} onChange={(e) => setAccionActiva({ ...accionActiva, fecha: e.target.value })} />
                <Button size="sm" onClick={() => editar.mutate({ id: accionActiva.gasto.id, categoria: accionActiva.categoria, descripcion: accionActiva.descripcion, monto: aNumero(accionActiva.monto), fecha: accionActiva.fecha }, { onSuccess: () => { toast.success("Gasto corregido"); setAccionActiva(null); } })}>Guardar</Button>
              </>
            )}
            {accionActiva.tipo === "cambiar-monto" && (
              <>
                <span className="font-medium">Cambiar el monto de «{accionActiva.gasto.descripcion}» desde:</span>
                <Input className="w-36" type="date" value={accionActiva.desde} onChange={(e) => setAccionActiva({ ...accionActiva, desde: e.target.value })} />
                <InputPlata className="w-32" placeholder="Monto nuevo" value={accionActiva.monto} onChange={(e) => setAccionActiva({ ...accionActiva, monto: e.target.value })} />
                <Button size="sm" onClick={() => cambiarMontoDesde.mutate({ id: accionActiva.gasto.id, desde: accionActiva.desde, monto: aNumero(accionActiva.monto) }, { onSuccess: () => { toast.success("Monto actualizado desde la fecha elegida"); setAccionActiva(null); } })}>Aplicar</Button>
              </>
            )}
            {accionActiva.tipo === "dejar-repetir" && (
              <>
                <span className="font-medium">Dejar de repetir «{accionActiva.gasto.descripcion}» desde:</span>
                <Input className="w-36" type="date" value={accionActiva.desde} onChange={(e) => setAccionActiva({ ...accionActiva, desde: e.target.value })} />
                <Button size="sm" onClick={() => dejarDeRepetir.mutate({ id: accionActiva.gasto.id, desde: accionActiva.desde }, { onSuccess: () => { toast.success("Ya no se repite desde esa fecha"); setAccionActiva(null); } })}>Confirmar</Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => setAccionActiva(null)}>Cancelar</Button>
          </div>
        )}

        {lista.length === 0 ? (
          <SinDatos mensaje="No hay gastos cargados en este período." />
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {lista.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="w-24 tabular-nums text-muted-foreground">
                  {fechaCorta(x.fecha)}
                  {x.fechaFin && <span className="block text-[11px]">hasta {fechaCorta(x.fechaFin)}</span>}
                </span>
                <span className="w-28 text-muted-foreground">{CATEGORIAS_GASTO[x.categoria] ?? x.categoria}</span>
                <span className="min-w-40 flex-1 truncate">
                  {x.descripcion}
                  {x.frecuencia && <span className="ml-2 rounded bg-muted px-1.5 text-xs">{FRECUENCIAS[x.frecuencia]}</span>}
                </span>
                <button
                  type="button"
                  className={x.tipoCosto === "fijo" ? "rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary" : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"}
                  title="Tocá para cambiar entre fijo y variable"
                  onClick={() => cambiarTipo.mutate({ id: x.id, tipoCosto: x.tipoCosto === "fijo" ? "variable" : "fijo" })}
                >
                  {x.tipoCosto === "fijo" ? "Fijo" : "Variable"}
                </button>
                <span className="text-right font-medium tabular-nums">
                  {formatoPesos(x.monto)}
                  {x.frecuencia && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {(() => {
                        const veces = vecesEnPeriodo(x, desde, hasta < hoyAR() ? hasta : hoyAR());
                        return veces === 1 ? "1 vez en el período" : `${veces} veces: ${formatoPesos(veces * x.monto)}`;
                      })()}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <Button size="icon-sm" variant="ghost" title="Editar (corrige toda la historia)" onClick={() => setAccionActiva({ tipo: "editar", gasto: x, categoria: x.categoria, descripcion: x.descripcion, monto: String(x.monto), fecha: x.fecha.slice(0, 10) })}>
                    <Pencil className="size-4" />
                  </Button>
                  {x.recurrente && (
                    <>
                      <Button size="icon-sm" variant="ghost" title="Cambiar el monto desde…" onClick={() => setAccionActiva({ tipo: "cambiar-monto", gasto: x, desde: hoyAR(), monto: String(x.monto) })}>
                        <TrendingUp className="size-4" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" title="Dejar de repetir" onClick={() => setAccionActiva({ tipo: "dejar-repetir", gasto: x, desde: hoyAR() })}>
                        <CalendarOff className="size-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title="Anular (lo cargué mal): se borra de todos los meses, también de los anteriores"
                    aria-label={`Anular gasto ${x.descripcion}`}
                    onClick={() => {
                      const msg = x.recurrente
                        ? `¿Anular "${x.descripcion}" (lo cargué mal)? Se borra de todos los meses, también de los anteriores.`
                        : `¿Anular "${x.descripcion}"?`;
                      if (window.confirm(msg)) {
                        anular.mutate(x.id, { onSuccess: () => toast.success("Gasto anulado") });
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
