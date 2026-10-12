"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Settings } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useRol } from "@/hooks/use-rol";
import { hoyAR, moverDias } from "@/lib/periodos";
import { COLOR_ESTADO_TURNO, TurnoPanel } from "./TurnoPanel";
import { TurnoForm } from "./TurnoForm";
import { diaSemana, fechaLarga, hhmm, minutos, NOMBRE_ESTADO_TURNO, OCUPAN, useBloqueos, useRecursos, useTurnos, type Recurso, type Turno } from "./use-agenda";

const PX_MIN = 1.1; // 66 px por hora
const PASO = 15;

type Abierto = { tipo: "nuevo"; sugerido?: { recursoId: string; inicio: string } } | { tipo: "turno"; id: string } | null;

/** Lunes de la semana de `fecha`. */
const lunesDe = (fecha: string) => moverDias(fecha, -((diaSemana(fecha) + 6) % 7));

/** Agenda: el día con una columna por profesional, o la semana entera. */
export function Agenda({ fechaInicial }: { fechaInicial?: string | null }) {
  const rol = useRol();
  const [fecha, setFecha] = useState(fechaInicial && /^\d{4}-\d{2}-\d{2}$/.test(fechaInicial) ? fechaInicial : hoyAR());
  const [vista, setVista] = useState<"dia" | "semana">("dia");
  const [abierto, setAbierto] = useState<Abierto>(null);
  const desde = vista === "dia" ? fecha : lunesDe(fecha);
  const hasta = vista === "dia" ? fecha : moverDias(desde, 6);
  const recursos = useRecursos();
  const turnos = useTurnos(desde, hasta);
  const bloqueos = useBloqueos(desde, hasta);
  const turnoAbierto = abierto?.tipo === "turno" ? (turnos.data?.find((t) => t.id === abierto.id) ?? null) : null;
  const mover = (dias: number) => setFecha((f) => moverDias(f, vista === "dia" ? dias : dias * 7));
  const hoy = hoyAR();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Agenda</h1>
        <div className="flex flex-wrap gap-2">
          {rol === "dueno" && (
            <Link href="/agenda/configuracion" className={buttonVariants({ variant: "outline" })}>
              <Settings aria-hidden /> Profesionales y horarios
            </Link>
          )}
          <Button onClick={() => setAbierto({ tipo: "nuevo" })} disabled={!recursos.data?.length}>
            <Plus aria-hidden /> Nuevo turno
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => mover(-1)} aria-label={vista === "dia" ? "Día anterior" : "Semana anterior"}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" onClick={() => setFecha(hoy)} disabled={fecha === hoy}>
          Hoy
        </Button>
        <Button variant="outline" size="icon" onClick={() => mover(1)} aria-label={vista === "dia" ? "Día siguiente" : "Semana siguiente"}>
          <ChevronRight />
        </Button>
        <Input type="date" className="w-auto" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} aria-label="Ir a un día" />
        <span className="font-medium">{vista === "dia" ? fechaLarga(fecha) : `Semana del ${desde.slice(8, 10)}/${desde.slice(5, 7)} al ${hasta.slice(8, 10)}/${hasta.slice(5, 7)}`}</span>
        <div className="ml-auto flex rounded-lg border p-0.5">
          {(["dia", "semana"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setVista(v)} className={`rounded-md px-3 py-1 text-sm ${vista === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {v === "dia" ? "Día" : "Semana"}
            </button>
          ))}
        </div>
      </div>

      {recursos.isLoading || turnos.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !recursos.data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-2 py-6">
            <p className="font-medium">Todavía no hay profesionales en la agenda.</p>
            <p className="text-sm text-muted-foreground">Cargá quién atiende (una persona, un sillón, una cancha) y en qué horarios. Después los turnos se agendan tocando un hueco del día.</p>
            {rol === "dueno" && (
              <Link href="/agenda/configuracion" className={buttonVariants()}>
                Cargar profesionales y horarios
              </Link>
            )}
          </CardContent>
        </Card>
      ) : vista === "dia" ? (
        <VistaDia
          fecha={fecha}
          recursos={recursos.data}
          turnos={turnos.data ?? []}
          cerrados={(bloqueos.data ?? []).filter((b) => b.fecha === fecha)}
          onHueco={(recursoId, hora) => setAbierto({ tipo: "nuevo", sugerido: { recursoId, inicio: `${fecha}T${hora}` } })}
          onTurno={(id) => setAbierto({ tipo: "turno", id })}
        />
      ) : (
        <VistaSemana desde={desde} turnos={turnos.data ?? []} onDia={(f) => (setFecha(f), setVista("dia"))} onTurno={(id) => setAbierto({ tipo: "turno", id })} />
      )}

      <Sheet open={abierto !== null} onOpenChange={(o) => !o && setAbierto(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{abierto?.tipo === "nuevo" ? "Nuevo turno" : "Turno"}</SheetTitle>
          </SheetHeader>
          {abierto?.tipo === "nuevo" && <TurnoForm key={abierto.sugerido ? `${abierto.sugerido.recursoId}${abierto.sugerido.inicio}` : "nuevo"} sugerido={abierto.sugerido ?? { recursoId: "", inicio: `${fecha}T` }} onListo={(t) => setAbierto({ tipo: "turno", id: t.id })} />}
          {turnoAbierto && <TurnoPanel key={turnoAbierto.id} turno={turnoAbierto} onCerrar={() => setAbierto(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function VistaDia({
  fecha,
  recursos,
  turnos,
  cerrados,
  onHueco,
  onTurno,
}: {
  fecha: string;
  recursos: Recurso[];
  turnos: Turno[];
  cerrados: { recursoId: string | null; motivo: string | null }[];
  onHueco: (recursoId: string, hora: string) => void;
  onTurno: (id: string) => void;
}) {
  const dia = diaSemana(fecha);
  const visibles = recursos.filter((r) => r.activo || turnos.some((t) => t.recursoId === r.id));
  const ocupan = turnos.filter((t) => OCUPAN.includes(t.estado));
  const liberados = turnos.filter((t) => !OCUPAN.includes(t.estado));
  // Del primer horario (o turno) del día al último, redondeado a horas; si no atiende nadie, 9 a 19.
  const marcas = [...visibles.flatMap((r) => r.horarios.filter((h) => h.diaSemana === dia).flatMap((h) => [minutos(h.desde), minutos(h.hasta)])), ...ocupan.flatMap((t) => [minutos(t.inicio.slice(11, 16)), minutos(t.fin.slice(11, 16)) || 1440])];
  const ini = marcas.length ? Math.floor(Math.min(...marcas) / 60) * 60 : 9 * 60;
  const fin = marcas.length ? Math.ceil(Math.max(...marcas) / 60) * 60 : 19 * 60;
  const alto = (fin - ini) * PX_MIN;
  const horas = Array.from({ length: (fin - ini) / 60 + 1 }, (_, i) => ini + i * 60);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="flex min-w-fit">
          <div className="w-12 shrink-0 border-r">
            <div className="h-9 border-b" />
            <div className="relative" style={{ height: alto }}>
              {horas.slice(0, -1).map((m) => (
                <span key={m} className="absolute right-1 -translate-y-1/2 text-[11px] text-muted-foreground first:translate-y-0" style={{ top: (m - ini) * PX_MIN }}>
                  {hhmm(m)}
                </span>
              ))}
            </div>
          </div>
          {visibles.map((r) => {
            const cerrado = cerrados.find((b) => b.recursoId === null || b.recursoId === r.id);
            return (
              <div key={r.id} className="min-w-40 flex-1 border-r last:border-r-0">
                <div className="flex h-9 items-center gap-2 border-b px-2 text-sm font-medium">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
                  <span className="truncate">{r.nombre}</span>
                </div>
                <div
                  className="relative cursor-pointer bg-muted/60"
                  style={{ height: alto }}
                  onClick={(e) => {
                    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                    onHueco(r.id, hhmm(Math.min(fin - PASO, ini + Math.floor(y / PX_MIN / PASO) * PASO)));
                  }}
                  role="button"
                  tabIndex={-1}
                  aria-label={`Agendar con ${r.nombre}`}
                >
                  {/* En horario de atención, el fondo es blanco. */}
                  {r.horarios
                    .filter((h) => h.diaSemana === dia)
                    .map((h) => (
                      <div key={h.desde} className="absolute inset-x-0 bg-card" style={{ top: (minutos(h.desde) - ini) * PX_MIN, height: (minutos(h.hasta) - minutos(h.desde)) * PX_MIN }} />
                    ))}
                  {horas.map((m) => (
                    <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-border/60" style={{ top: (m - ini) * PX_MIN }} />
                  ))}
                  {cerrado && (
                    <div className="pointer-events-none absolute inset-0 flex items-start justify-center bg-muted/80 pt-6 text-sm text-muted-foreground">Cerrado{cerrado.motivo ? `: ${cerrado.motivo}` : ""}</div>
                  )}
                  {ocupan
                    .filter((t) => t.recursoId === r.id)
                    .map((t) => {
                      const desdeMin = minutos(t.inicio.slice(11, 16));
                      const alturaTurno = Math.max(t.duracionMin * PX_MIN, 22);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={(e) => (e.stopPropagation(), onTurno(t.id))}
                          className={`absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs shadow-sm ${t.estado === "atendido" ? "bg-emerald-50 dark:bg-emerald-950" : "bg-background"}`}
                          style={{ top: (desdeMin - ini) * PX_MIN, height: alturaTurno, borderLeftColor: r.color }}
                        >
                          <span className="font-medium">{t.inicio.slice(11, 16)}</span> {t.clienteNombre}
                          {alturaTurno > 34 && t.servicio && <span className="block truncate text-muted-foreground">{t.servicio}</span>}
                          {t.ventaId && <span className="sr-only"> (cobrado)</span>}
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {liberados.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Cancelados y ausentes del día</span>
          <div className="flex flex-wrap gap-2">
            {liberados.map((t) => (
              <button key={t.id} type="button" onClick={() => onTurno(t.id)} className="rounded-md border px-2 py-1 text-left text-xs hover:bg-muted">
                {t.inicio.slice(11, 16)} {t.clienteNombre} · {t.recurso} <span className={`ml-1 rounded-full px-1.5 ${COLOR_ESTADO_TURNO[t.estado]}`}>{NOMBRE_ESTADO_TURNO[t.estado]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VistaSemana({ desde, turnos, onDia, onTurno }: { desde: string; turnos: Turno[]; onDia: (fecha: string) => void; onTurno: (id: string) => void }) {
  const hoy = hoyAR();
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
      {Array.from({ length: 7 }, (_, i) => moverDias(desde, i)).map((f) => {
        const delDia = turnos.filter((t) => t.inicio.startsWith(f) && OCUPAN.includes(t.estado));
        return (
          <div key={f} className={`flex min-h-32 flex-col gap-1 rounded-xl border bg-card p-2 ${f === hoy ? "ring-2 ring-primary/40" : ""}`}>
            <button type="button" onClick={() => onDia(f)} className="flex items-baseline justify-between text-left text-sm font-medium hover:underline">
              {fechaLarga(f)}
              <span className="text-xs font-normal text-muted-foreground">{delDia.length || ""}</span>
            </button>
            {delDia.map((t) => (
              <button key={t.id} type="button" onClick={() => onTurno(t.id)} className="flex items-center gap-1.5 truncate rounded-md px-1 py-0.5 text-left text-xs hover:bg-muted">
                <span className="size-2 shrink-0 rounded-full" style={{ background: t.color }} aria-hidden />
                <span className="font-medium">{t.inicio.slice(11, 16)}</span>
                <span className="truncate">{t.clienteNombre}</span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
