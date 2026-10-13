"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { hoyAR, moverDias } from "@/lib/periodos";
import { DIAS_SEMANA, useAccionesAgenda, useBloqueos, useConfigAgenda, useRecursos, useTiendaDireccion, type ConfigAgenda, type Horario, type Recurso } from "./use-agenda";

const COLORES = ["#6366f1", "#e11d48", "#059669", "#d97706", "#0891b2", "#7c3aed", "#db2777", "#65a30d"];
// Lunes primero, domingo al final.
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];
const HABITUAL: Horario[] = [1, 2, 3, 4, 5].map((d) => ({ diaSemana: d, desde: "09:00", hasta: "18:00" }));

/** Profesionales (o recursos) con su horario semanal, y los días cerrados. Solo el dueño. */
export function AgendaConfig() {
  const recursos = useRecursos();
  const [nuevo, setNuevo] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      {recursos.isLoading && <Skeleton className="h-40 w-full" />}
      {(recursos.data ?? []).map((r) => (
        <RecursoCard key={r.id} recurso={r} />
      ))}
      {nuevo ? (
        <RecursoCard orden={recursos.data?.length ?? 0} onListo={() => setNuevo(false)} />
      ) : (
        <Button variant="outline" className="w-fit" onClick={() => setNuevo(true)}>
          <Plus aria-hidden /> Agregar profesional o recurso
        </Button>
      )}
      <DiasCerrados recursos={recursos.data ?? []} />
      <ReservaOnlineCarga />
    </div>
  );
}

function RecursoCard({ recurso, orden = 0, onListo }: { recurso?: Recurso; orden?: number; onListo?: () => void }) {
  const { crearRecurso, editarRecurso, borrarRecurso } = useAccionesAgenda();
  const [nombre, setNombre] = useState(recurso?.nombre ?? "");
  const [color, setColor] = useState(recurso?.color ?? COLORES[orden % COLORES.length]);
  const [online, setOnline] = useState(recurso?.online ?? true);
  const [activo, setActivo] = useState(recurso?.activo ?? true);
  const [horarios, setHorarios] = useState<Horario[]>(recurso?.horarios ?? HABITUAL);
  const [error, setError] = useState<string | null>(null);
  const guardando = crearRecurso.isPending || editarRecurso.isPending;

  const cambiar = (i: number, cambios: Partial<Horario>) => setHorarios((prev) => prev.map((h, j) => (j === i ? { ...h, ...cambios } : h)));

  function guardar() {
    if (!nombre.trim()) return setError("Poné un nombre.");
    setError(null);
    const datos = { nombre: nombre.trim(), usuarioId: recurso?.usuarioId ?? null, color, online, activo, horarios };
    const listo = { onSuccess: () => (toast.success(`${datos.nombre} guardado`), onListo?.()), onError: (e: unknown) => setError(e instanceof Error ? e.message : "No se pudo guardar") };
    if (recurso) editarRecurso.mutate({ id: recurso.id, ...datos }, listo);
    else crearRecurso.mutate(datos, listo);
  }

  function borrar() {
    if (!recurso || !window.confirm(`¿Sacar a ${recurso.nombre} de la agenda? Los turnos pasados quedan.`)) return;
    borrarRecurso.mutate(recurso.id, { onSuccess: () => toast.success(`${recurso.nombre} ya no está en la agenda`), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo borrar") });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: color }} aria-hidden />
          {recurso ? recurso.nombre : "Nuevo profesional o recurso"}
          {recurso && !recurso.activo && <span className="text-xs font-normal text-muted-foreground">(pausado)</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`rec-nombre-${recurso?.id ?? "nuevo"}`}>Nombre</Label>
            <Input id={`rec-nombre-${recurso?.id ?? "nuevo"}`} maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Sofi, Sillón 2, Cancha 1" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Color en la agenda</span>
            <div className="flex flex-wrap gap-1.5">
              {COLORES.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`size-7 rounded-full ${c === color ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`} style={{ background: c }} aria-label={`Color ${c}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Horario de atención</span>
          {ORDEN_DIAS.map((d) => {
            const del = horarios.map((h, i) => ({ h, i })).filter((x) => x.h.diaSemana === d);
            return (
              <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-24 text-muted-foreground">{DIAS_SEMANA[d]}</span>
                {del.length === 0 && <span className="text-muted-foreground">No atiende</span>}
                {del.map(({ h, i }) => (
                  <span key={i} className="flex items-center gap-1">
                    <Input type="time" step={900} className="h-8 w-28" value={h.desde} onChange={(e) => cambiar(i, { desde: e.target.value })} aria-label={`${DIAS_SEMANA[d]} desde`} />a
                    <Input type="time" step={900} className="h-8 w-28" value={h.hasta} onChange={(e) => cambiar(i, { hasta: e.target.value })} aria-label={`${DIAS_SEMANA[d]} hasta`} />
                    <Button variant="ghost" size="icon-sm" onClick={() => setHorarios((prev) => prev.filter((_, j) => j !== i))} aria-label="Quitar este horario">
                      <Trash2 />
                    </Button>
                  </span>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setHorarios((prev) => [...prev, { diaSemana: d, desde: del.length ? "15:00" : "09:00", hasta: del.length ? "19:00" : "13:00" }])}>
                  <Plus aria-hidden /> {del.length ? "Otro tramo" : "Agregar"}
                </Button>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} />
            Se puede reservar online desde la tienda (cuando esté activada la reserva online)
          </label>
          {recurso && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
              Activo (si lo pausás, no se le pueden dar turnos nuevos)
            </label>
          )}
        </div>
        {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={guardar} disabled={guardando}>
            {guardando && <Loader2 className="animate-spin" aria-hidden />}
            Guardar
          </Button>
          {onListo && (
            <Button variant="ghost" onClick={onListo}>
              Cancelar
            </Button>
          )}
          {recurso && (
            <Button variant="ghost" className="ml-auto text-destructive" onClick={borrar} disabled={borrarRecurso.isPending}>
              <Trash2 aria-hidden /> Sacar de la agenda
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DiasCerrados({ recursos }: { recursos: Recurso[] }) {
  const hoy = hoyAR();
  const bloqueos = useBloqueos(hoy, moverDias(hoy, 365));
  const { crearBloqueo, borrarBloqueo } = useAccionesAgenda();
  const [fecha, setFecha] = useState("");
  const [recursoId, setRecursoId] = useState("");
  const [motivo, setMotivo] = useState("");

  function agregar() {
    if (!fecha) return toast.error("Elegí el día.");
    crearBloqueo.mutate(
      { fecha, recursoId: recursoId || null, motivo: motivo.trim() || null },
      { onSuccess: () => (setFecha(""), setMotivo(""), toast.success("Día cerrado agregado")), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo agregar") },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Días cerrados</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Feriados, vacaciones o un día que alguien no viene. Esos días no se pueden dar turnos (salvo que se fuerce desde la agenda).</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bl-fecha">Día</Label>
            <Input id="bl-fecha" type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bl-recurso">Para</Label>
            <select id="bl-recurso" className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={recursoId} onChange={(e) => setRecursoId(e.target.value)}>
              <option value="">Todos (cierra el negocio)</option>
              {recursos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bl-motivo">Motivo</Label>
            <Input id="bl-motivo" maxLength={120} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Feriado" />
          </div>
          <Button onClick={agregar} disabled={crearBloqueo.isPending}>
            <Plus aria-hidden /> Agregar
          </Button>
        </div>
        {(bloqueos.data ?? []).length > 0 && (
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {bloqueos.data!.map((b) => (
              <li key={b.id} className="flex items-center gap-2 px-3 py-2">
                <span className="font-medium">{`${b.fecha.slice(8, 10)}/${b.fecha.slice(5, 7)}/${b.fecha.slice(0, 4)}`}</span>
                <span className="text-muted-foreground">{b.recursoId ? (recursos.find((r) => r.id === b.recursoId)?.nombre ?? "—") : "Todos"}</span>
                {b.motivo && <span>· {b.motivo}</span>}
                <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => borrarBloqueo.mutate(b.id)} aria-label="Quitar día cerrado">
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ReservaOnlineCarga() {
  const config = useConfigAgenda();
  if (!config.data) return <Skeleton className="h-32 w-full" />;
  return <ReservaOnline inicial={config.data} />;
}

const ANTICIPACIONES = [
  { valor: 0, nombre: "Sin mínimo" },
  { valor: 60, nombre: "1 hora" },
  { valor: 120, nombre: "2 horas" },
  { valor: 240, nombre: "4 horas" },
  { valor: 720, nombre: "12 horas" },
  { valor: 1440, nombre: "1 día" },
  { valor: 2880, nombre: "2 días" },
];

function ReservaOnline({ inicial }: { inicial: ConfigAgenda }) {
  const tienda = useTiendaDireccion();
  const { guardarConfig } = useAccionesAgenda();
  const [c, setC] = useState(inicial);
  const direccion = tienda.data ? `https://${tienda.data.dominioPropio ?? `${tienda.data.subdominio}.analitica360.app`}/turnos` : null;

  function guardar() {
    guardarConfig.mutate(c, { onSuccess: () => toast.success(c.reservaOnline ? "Reserva online prendida" : "Reserva online guardada"), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar") });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reserva online</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground">Tus clientes eligen el servicio, el profesional (o «el que esté libre»), el día y la hora desde tu tienda online. El turno aparece en la agenda marcado como reserva online.</p>
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" checked={c.reservaOnline} onChange={(e) => setC({ ...c, reservaOnline: e.target.checked })} />
          Tomar turnos desde la tienda
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ro-anticipacion">Anticipación mínima</Label>
            <select id="ro-anticipacion" className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={c.anticipacionMin} onChange={(e) => setC({ ...c, anticipacionMin: Number(e.target.value) })}>
              {ANTICIPACIONES.map((a) => (
                <option key={a.valor} value={a.valor}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ro-dias">Hasta cuántos días para adelante</Label>
            <Input id="ro-dias" type="number" min={1} max={365} value={c.diasMaximo} onChange={(e) => setC({ ...c, diasMaximo: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ro-mensaje">Mensaje para el cliente al reservar (opcional)</Label>
            <Input id="ro-mensaje" maxLength={300} value={c.mensaje ?? ""} onChange={(e) => setC({ ...c, mensaje: e.target.value })} placeholder="Ej. Llegá 5 minutos antes. Si no podés venir, avisanos por WhatsApp." />
          </div>
        </div>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>Solo se ofrecen los profesionales con «Se puede reservar online» tildado y con horario cargado.</li>
          <li>Los servicios son los activos de Productos marcados como servicio, con su duración y su precio (si es fijo).</li>
          {tienda.data && !tienda.data.activa && <li className="text-amber-600">Tu tienda online está apagada: prendela en Configuración → Tienda online para que se vea.</li>}
        </ul>
        {c.reservaOnline && direccion && tienda.data?.activa && (
          <p>
            Dirección para compartir:{" "}
            <a href={direccion} target="_blank" rel="noreferrer" className="font-medium text-primary underline">
              {direccion.replace("https://", "")}
            </a>
          </p>
        )}
        <Button className="w-fit" onClick={guardar} disabled={guardarConfig.isPending}>
          {guardarConfig.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}
