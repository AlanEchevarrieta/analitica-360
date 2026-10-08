"use client";

import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { useRol } from "@/hooks/use-rol";
import { useAccionesObjetivo, useObjetivos, useOpcionesObjetivo, type Objetivo } from "../hooks/use-objetivos";
import { ObjetivoForm } from "./ObjetivoForm";
import { TarjetaObjetivo } from "./TarjetaObjetivo";

type Filtro = "todos" | "empresa" | "sucursales" | "usuarios";

const GRUPOS: { id: Exclude<Filtro, "todos">; titulo: string; incluye: (o: Objetivo) => boolean }[] = [
  { id: "empresa", titulo: "Toda la empresa", incluye: (o) => !o.ubicacion && !o.usuario },
  { id: "sucursales", titulo: "Por sucursal", incluye: (o) => Boolean(o.ubicacion) },
  { id: "usuarios", titulo: "Por usuario", incluye: (o) => Boolean(o.usuario) },
];

export function ObjetivosVista() {
  const esDueno = useRol() === "dueno";
  const { data, isPending, isError, error, refetch } = useObjetivos();
  const { data: opciones } = useOpcionesObjetivo(esDueno);
  const { borrar } = useAccionesObjetivo();
  const [editando, setEditando] = useState<Objetivo | "nuevo" | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const pedirBorrar = (o: Objetivo) => {
    if (!window.confirm("¿Borrar este objetivo? Se pierde también su historial.")) return;
    borrar.mutate(o.id, { onSuccess: () => toast.success("Objetivo borrado"), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo borrar") });
  };

  if (isPending) return <CargandoFilas filas={4} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;

  const grupos = GRUPOS.map((g) => ({ ...g, items: data.filter(g.incluye) })).filter((g) => g.items.length > 0 && (filtro === "todos" || filtro === g.id));
  const resumen = { bien: data.filter((o) => o.actual.semaforo === "bien").length, total: data.length };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar objetivos">
          {(["todos", "empresa", "sucursales", "usuarios"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filtro === f}
              onClick={() => setFiltro(f)}
              className={filtro === f ? "rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground" : "rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"}
            >
              {f === "todos" ? "Todos" : GRUPOS.find((g) => g.id === f)!.titulo}
            </button>
          ))}
        </div>
        {esDueno && opciones && editando == null && (
          <Button onClick={() => setEditando("nuevo")}>
            <Plus className="size-4" /> Nuevo objetivo
          </Button>
        )}
      </div>

      {editando != null && opciones && <ObjetivoForm key={editando === "nuevo" ? "nuevo" : editando.id} opciones={opciones} inicial={editando === "nuevo" ? undefined : editando} onCerrar={() => setEditando(null)} />}

      {data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center">
          <Target className="size-8 text-primary" />
          <p className="font-medium">Todavía no hay objetivos</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {esDueno
              ? "Fijá una meta de facturación, ganancia, producción o despacho de pedidos, para toda la empresa, una sucursal o un usuario. Vas a ver cómo venís, a qué ritmo y cómo cerrás el período."
              : "Cuando el dueño te asigne un objetivo, lo vas a ver acá con tu avance."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {resumen.bien} de {resumen.total} {resumen.total === 1 ? "objetivo va" : "objetivos van"} en camino en el período actual. La raya en la barra marca dónde deberías estar hoy.
          </p>
          {grupos.map((g) => (
            <section key={g.id} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">{g.titulo}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((o) => (
                  <TarjetaObjetivo key={o.id} o={o} onEditar={esDueno ? () => setEditando(o) : undefined} onBorrar={esDueno ? () => pedirBorrar(o) : undefined} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
