"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import {
  NOMBRE_APROBACION,
  useAccionesProyecto,
  usePlantillasProyecto,
  useResponsablesProyecto,
  type PlantillaProyecto,
  type TipoAprobacion,
} from "./use-proyectos";

interface EtapaDraft {
  nombre: string;
  diasObjetivo: number | null;
  aprobacion: TipoAprobacion;
  aprobadorInternoId: string | null;
}

export function PlantillasProyectoConfig() {
  const { data, isPending, isError, error, refetch } = usePlantillasProyecto();
  const responsables = useResponsablesProyecto();
  const { guardarPlantilla, archivarPlantilla } = useAccionesProyecto();

  const [editandoId, setEditandoId] = useState<string | "nueva" | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [etapas, setEtapas] = useState<EtapaDraft[]>([]);

  if (isPending) return <CargandoFilas filas={4} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;

  const abrirEdicion = (p?: PlantillaProyecto) => {
    if (!p) {
      setEditandoId("nueva");
      setNombre("");
      setDescripcion("");
      setEtapas([
        { nombre: "Inicio", diasObjetivo: 2, aprobacion: "ninguna", aprobadorInternoId: null },
        { nombre: "Revisión del cliente", diasObjetivo: 3, aprobacion: "cliente", aprobadorInternoId: null },
      ]);
      return;
    }
    setEditandoId(p.id);
    setNombre(p.nombre);
    setDescripcion(p.descripcion ?? "");
    setEtapas(
      p.etapas.map((e) => ({
        nombre: e.nombre,
        diasObjetivo: e.diasObjetivo,
        aprobacion: e.aprobacion,
        aprobadorInternoId: e.aprobadorInternoId,
      })),
    );
  };

  const mover = (idx: number, dir: -1 | 1) => {
    setEtapas((prev) => {
      const destino = idx + dir;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      const [item] = copia.splice(idx, 1);
      copia.splice(destino, 0, item);
      return copia;
    });
  };

  const guardar = () => {
    if (!nombre.trim() || etapas.length === 0) {
      toast.error("Poné un nombre y al menos una etapa");
      return;
    }
    guardarPlantilla.mutate(
      {
        ...(editandoId && editandoId !== "nueva" ? { id: editandoId } : {}),
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        etapas: etapas.map((e) => ({
          nombre: e.nombre.trim(),
          diasObjetivo: e.diasObjetivo,
          aprobacion: e.aprobacion,
          aprobadorInternoId: e.aprobadorInternoId || null,
        })),
      },
      {
        onSuccess: () => {
          toast.success("Plantilla guardada");
          setEditandoId(null);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "No se pudo guardar"),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground">
          Plantillas con las etapas, plazos y aprobaciones que se copian al crear un proyecto nuevo.
        </p>
        <Button size="sm" onClick={() => abrirEdicion()}>
          <Plus className="size-3.5" aria-hidden /> Nueva plantilla
        </Button>
      </div>

      {editandoId && (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Nombre de la plantilla (ej. Campaña)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <Input
              placeholder="Descripción breve (opcional)"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            {etapas.map((et, idx) => (
              <div
                key={idx}
                className="grid items-center gap-2 rounded-lg border bg-background p-2 sm:grid-cols-[auto_1fr_5rem_11rem_10rem_auto]"
              >
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={idx === 0}
                    onClick={() => mover(idx, -1)}
                    aria-label="Subir etapa"
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    disabled={idx === etapas.length - 1}
                    onClick={() => mover(idx, 1)}
                    aria-label="Bajar etapa"
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                </div>
                <Input
                  className="h-8 text-xs"
                  placeholder="Nombre de la etapa"
                  value={et.nombre}
                  onChange={(e) =>
                    setEtapas((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, nombre: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  className="h-8 text-xs"
                  type="number"
                  min={1}
                  placeholder="Días"
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
                  className="h-8 rounded-lg border bg-transparent px-2 text-xs"
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
                  className="h-8 rounded-lg border bg-transparent px-2 text-xs"
                  value={et.aprobadorInternoId ?? ""}
                  onChange={(e) =>
                    setEtapas((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, aprobadorInternoId: e.target.value || null } : x,
                      ),
                    )
                  }
                >
                  <option value="">Aprobador interno…</option>
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
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setEtapas((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="Quitar etapa"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() =>
                setEtapas((prev) => [
                  ...prev,
                  { nombre: "", diasObjetivo: 2, aprobacion: "ninguna", aprobadorInternoId: null },
                ])
              }
            >
              <Plus className="size-3.5" aria-hidden /> Sumar etapa
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={guardar} disabled={guardarPlantilla.isPending}>
              Guardar plantilla
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <ul className="flex flex-col divide-y rounded-xl border">
        {(data ?? []).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{p.nombre}</span>
              {p.descripcion && <span className="text-xs text-muted-foreground">{p.descripcion}</span>}
              <span className="text-xs text-muted-foreground">
                {p.etapas.map((e) => e.nombre).join(" → ")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={() => abrirEdicion(p)}>
                Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={archivarPlantilla.isPending}
                onClick={() =>
                  archivarPlantilla.mutate(p.id, {
                    onSuccess: () => toast.success("Plantilla archivada"),
                    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo archivar"),
                  })
                }
              >
                Archivar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
