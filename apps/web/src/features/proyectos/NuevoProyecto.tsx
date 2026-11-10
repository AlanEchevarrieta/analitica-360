"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hoyAR } from "@/lib/periodos";
import {
  NOMBRE_APROBACION,
  fechaCortaAR,
  useAccionesProyecto,
  usePlantillasProyecto,
  useResponsablesProyecto,
  type TipoAprobacion,
} from "./use-proyectos";

interface EtapaForm {
  nombre: string;
  diasObjetivo: number | null;
  aprobacion: TipoAprobacion;
  responsableId: string;
}

function calcularAvisoFechas(inicio: string, etapas: EtapaForm[], comprometida: string) {
  if (!inicio || !comprometida) return null;
  let suma = 0;
  let ultima: string | null = null;
  const base = new Date(`${inicio}T00:00:00Z`);
  for (const e of etapas) {
    if (e.diasObjetivo && e.diasObjetivo > 0) {
      suma += e.diasObjetivo;
      const d = new Date(base.getTime());
      d.setUTCDate(d.getUTCDate() + suma);
      ultima = d.toISOString().slice(0, 10);
    }
  }
  if (ultima && ultima > comprometida) {
    return `Con estos plazos terminás el ${fechaCortaAR(ultima)}, después de lo comprometido (${fechaCortaAR(comprometida)}).`;
  }
  return null;
}

export function NuevoProyecto() {
  const router = useRouter();
  const plantillas = usePlantillasProyecto();
  const responsables = useResponsablesProyecto();
  const { crear } = useAccionesProyecto();

  const [nombre, setNombre] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [plantillaId, setPlantillaId] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [fechaInicio, setFechaInicio] = useState(hoyAR());
  const [fechaComprometida, setFechaComprometida] = useState("");
  const [montoAcordado, setMontoAcordado] = useState("");
  const [etapas, setEtapas] = useState<EtapaForm[]>([]);

  const elegirPlantilla = (id: string) => {
    setPlantillaId(id);
    const pl = (plantillas.data ?? []).find((p) => p.id === id);
    if (pl) {
      setEtapas(
        pl.etapas.map((e) => ({
          nombre: e.nombre,
          diasObjetivo: e.diasObjetivo,
          aprobacion: e.aprobacion,
          responsableId: responsableId || "",
        })),
      );
    }
  };

  const avisoPlazos = calcularAvisoFechas(fechaInicio, etapas, fechaComprometida);

  const guardar = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!nombre.trim()) {
      toast.error("Poné el nombre del proyecto");
      return;
    }
    if (etapas.length === 0 && !plantillaId) {
      toast.error("Elegí una plantilla o agregá al menos una etapa");
      return;
    }
    crear.mutate(
      {
        nombre: nombre.trim(),
        clienteNombre: clienteNombre.trim() || null,
        descripcion: descripcion.trim() || null,
        plantillaId: plantillaId || null,
        responsableId: responsableId || null,
        fechaInicio,
        fechaComprometida: fechaComprometida || null,
        montoAcordado: montoAcordado ? Number(montoAcordado) : null,
        etapas: etapas.map((e) => ({
          nombre: e.nombre.trim(),
          diasObjetivo: e.diasObjetivo,
          aprobacion: e.aprobacion,
          responsableId: e.responsableId || responsableId || null,
        })),
      },
      {
        onSuccess: (creado) => {
          toast.success("Proyecto creado");
          router.push(`/proyectos/${creado.id}`);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo crear el proyecto"),
      },
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/proyectos" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="size-4" aria-hidden /> Proyectos
        </Link>
        <h1 className="text-xl font-semibold">Nuevo proyecto</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos y etapas del proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={guardar} className="flex flex-col gap-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pry-nombre">Nombre del proyecto</Label>
                <Input
                  id="pry-nombre"
                  placeholder="Ej. Campaña Día de la Madre – Óptica Sur"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pry-cliente">Cliente</Label>
                <Input
                  id="pry-cliente"
                  placeholder="Nombre del cliente o empresa"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pry-plantilla">Plantilla</Label>
                <select
                  id="pry-plantilla"
                  className="h-9 rounded-lg border bg-transparent px-2.5 text-sm"
                  value={plantillaId}
                  onChange={(e) => elegirPlantilla(e.target.value)}
                >
                  <option value="">Elegir plantilla…</option>
                  {(plantillas.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.etapas.length} etapas)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pry-resp">Responsable del proyecto</Label>
                <select
                  id="pry-resp"
                  className="h-9 rounded-lg border bg-transparent px-2.5 text-sm"
                  value={responsableId}
                  onChange={(e) => setResponsableId(e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {(responsables.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pry-inicio">Fecha de inicio</Label>
                <Input
                  id="pry-inicio"
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pry-comp">Fecha comprometida</Label>
                <Input
                  id="pry-comp"
                  type="date"
                  value={fechaComprometida}
                  onChange={(e) => setFechaComprometida(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pry-monto">Monto acordado (opcional)</Label>
                <Input
                  id="pry-monto"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={montoAcordado}
                  onChange={(e) => setMontoAcordado(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pry-desc">Descripción o alcance (opcional)</Label>
              <Input
                id="pry-desc"
                placeholder="Objetivos, entregables o notas generales"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Etapas ({etapas.length})</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setEtapas((prev) => [
                      ...prev,
                      { nombre: "", diasObjetivo: 2, aprobacion: "ninguna", responsableId: "" },
                    ])
                  }
                >
                  <Plus className="size-3.5" aria-hidden /> Agregar etapa
                </Button>
              </div>
              {etapas.map((et, idx) => (
                <div
                  key={idx}
                  className="grid items-center gap-2 rounded-lg border p-2.5 sm:grid-cols-[1fr_5rem_11rem_10rem_auto]"
                >
                  <Input
                    placeholder="Nombre de la etapa"
                    value={et.nombre}
                    onChange={(e) =>
                      setEtapas((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, nombre: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    type="number"
                    min={1}
                    placeholder="Días"
                    title="Días objetivo"
                    value={et.diasObjetivo ?? ""}
                    onChange={(e) =>
                      setEtapas((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? { ...x, diasObjetivo: e.target.value ? Number(e.target.value) : null }
                            : x,
                        ),
                      )
                    }
                  />
                  <select
                    className="h-9 rounded-lg border bg-transparent px-2 text-xs"
                    value={et.aprobacion}
                    onChange={(e) =>
                      setEtapas((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, aprobacion: e.target.value as TipoAprobacion } : x,
                        ),
                      )
                    }
                  >
                    {Object.entries(NOMBRE_APROBACION).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-9 rounded-lg border bg-transparent px-2 text-xs"
                    value={et.responsableId}
                    onChange={(e) =>
                      setEtapas((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, responsableId: e.target.value } : x)),
                      )
                    }
                  >
                    <option value="">Responsable…</option>
                    {(responsables.data ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setEtapas((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>

            {avisoPlazos && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                ⚠️ {avisoPlazos}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={crear.isPending}>
                Crear proyecto
              </Button>
              <Link href="/proyectos" className={buttonVariants({ variant: "ghost" })}>
                Cancelar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
