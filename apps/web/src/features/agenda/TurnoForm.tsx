"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProductos } from "@/features/productos/hooks/use-productos";
import { useClientes } from "@/features/ventas/hooks/use-nueva-venta";
import { formatoPesos } from "@/lib/formato";
import { useAccionesAgenda, useLibres, useRecursos, type Turno } from "./use-agenda";

const selectCls = "h-8 rounded-lg border bg-transparent px-2 text-sm";

export const FILTRO_SERVICIOS = { pagina: 1, pageSize: 200, busqueda: "", estado: "activos", orden: "nombre", tipo: "servicios" } as const;

/** Alta o reprogramación de un turno. `inicial` = reprogramar; `sugerido` = el hueco que se tocó en la agenda. */
export function TurnoForm({ inicial, sugerido, onListo }: { inicial?: Turno; sugerido?: { recursoId: string; inicio: string }; onListo: (t: Turno) => void }) {
  const recursos = useRecursos();
  const servicios = useProductos(FILTRO_SERVICIOS);
  const clientes = useClientes();
  const { crearTurno, reprogramar } = useAccionesAgenda();
  const activos = (recursos.data ?? []).filter((r) => r.activo);
  const [recursoId, setRecursoId] = useState(inicial?.recursoId ?? sugerido?.recursoId ?? "");
  const [servicioId, setServicioId] = useState(inicial?.servicioId ?? "");
  const [cliente, setCliente] = useState(inicial?.clienteNombre ?? "");
  const [telefono, setTelefono] = useState(inicial?.clienteTelefono ?? "");
  const inicio = inicial?.inicio ?? sugerido?.inicio ?? "";
  const [fecha, setFecha] = useState(inicio.slice(0, 10));
  const [hora, setHora] = useState(inicio.slice(11, 16));
  const [duracion, setDuracion] = useState(inicial ? String(inicial.duracionMin) : "");
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const [forzar, setForzar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recurso = recursoId || activos[0]?.id || "";
  const servicio = servicios.data?.items.find((s) => s.id === servicioId) ?? null;
  const minutosElegidos = Number(duracion) > 0 ? Number(duracion) : null;
  const libres = useLibres(recurso || null, fecha, servicioId || null, minutosElegidos);
  const elegido = clientes.data?.find((c) => c.nombre.toLowerCase() === cliente.trim().toLowerCase());
  const guardando = crearTurno.isPending || reprogramar.isPending;

  function guardar() {
    if (!recurso) return setError("Primero cargá un profesional en «Profesionales y horarios».");
    if (!cliente.trim()) return setError("Cargá a quién es el turno.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return setError("Elegí el día y la hora.");
    setError(null);
    const datos = {
      recursoId: recurso,
      servicioId: servicioId || null,
      clienteId: elegido?.id ?? null,
      clienteNombre: elegido ? null : cliente.trim(),
      clienteTelefono: telefono.trim() || null,
      inicio: `${fecha}T${hora}`,
      // Al reprogramar con otro servicio, la API conservaría la duración vieja: mandamos la del servicio.
      duracionMin: minutosElegidos ?? (inicial ? (servicio?.duracionMin ?? null) : null),
      notas: notas.trim() || null,
      forzar,
    };
    const listo = { onSuccess: (t: Turno) => (toast.success(inicial ? "Turno reprogramado" : `Turno agendado para ${t.clienteNombre}`), onListo(t)), onError: (e: unknown) => setError(e instanceof Error ? e.message : "No se pudo guardar") };
    if (inicial) reprogramar.mutate({ id: inicial.id, ...datos }, listo);
    else crearTurno.mutate(datos, listo);
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tu-recurso">Con quién</Label>
        <select id="tu-recurso" className={selectCls} value={recurso} onChange={(e) => setRecursoId(e.target.value)}>
          {activos.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tu-servicio">Servicio</Label>
        <select id="tu-servicio" className={selectCls} value={servicioId} onChange={(e) => (setServicioId(e.target.value), setDuracion(""))}>
          <option value="">Sin servicio (solo el horario)</option>
          {(servicios.data?.items ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
              {s.duracionMin ? ` · ${s.duracionMin} min` : ""}
              {s.modoPrecio === "fijo" && s.precioVenta ? ` · ${formatoPesos(s.precioVenta)}` : ""}
            </option>
          ))}
        </select>
        {servicios.data && servicios.data.items.length === 0 && <p className="text-xs text-muted-foreground">Todavía no cargaste servicios: se dan de alta en Productos, marcando «Es un servicio».</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tu-cliente">Cliente</Label>
        <Input id="tu-cliente" list="tu-clientes" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Elegí o escribí un nombre" autoComplete="off" />
        <datalist id="tu-clientes">
          {(clientes.data ?? []).map((c) => (
            <option key={c.id} value={c.nombre} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tu-telefono">Teléfono (para el recordatorio)</Label>
        <Input id="tu-telefono" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder={elegido?.telefono ? `El de su ficha: ${elegido.telefono}` : "Ej. 261 555 1234"} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tu-fecha">Día</Label>
          <Input id="tu-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tu-hora">Hora</Label>
          <Input id="tu-hora" type="time" step={300} value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
      </div>
      {libres.data && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{libres.data.libres.length ? `Libres ese día (${libres.data.duracionMin} min):` : "Ese día no le quedan horarios libres."}</span>
          <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
            {libres.data.libres.map((h) => (
              <button key={h} type="button" onClick={() => setHora(h)} className={`rounded-md border px-2 py-0.5 text-xs ${h === hora ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {h}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tu-duracion">Duración (minutos)</Label>
        <Input id="tu-duracion" type="number" min={5} max={1440} step={5} value={duracion} onChange={(e) => setDuracion(e.target.value)} placeholder={String(servicio?.duracionMin ?? 30)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tu-notas">Notas</Label>
        <textarea id="tu-notas" rows={2} maxLength={1000} className="rounded-lg border bg-transparent px-3 py-2 text-sm" value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={forzar} onChange={(e) => setForzar(e.target.checked)} />
        Agendar igual aunque esté fuera de horario o el día esté cerrado
      </label>
      {error && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
      <Button onClick={guardar} disabled={guardando}>
        {guardando && <Loader2 className="animate-spin" aria-hidden />}
        {inicial ? "Guardar cambios" : "Agendar turno"}
      </Button>
    </div>
  );
}
