"use client";

import Link from "next/link";
import { Target } from "lucide-react";
import { useObjetivos } from "../hooks/use-objetivos";
import { TarjetaObjetivo } from "./TarjetaObjetivo";

/** En Inicio: los objetivos del período actual (hasta 3), si hay. */
export function ObjetivosInicio() {
  const { data } = useObjetivos();
  if (!data || data.length === 0) return null;
  const orden = { mal: 0, justo: 1, bien: 2, sin_datos: 3 };
  const primeros = [...data].sort((a, b) => orden[a.actual.semaforo] - orden[b.actual.semaforo]).slice(0, 3);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Target className="size-4 text-primary" /> Objetivos
        </h2>
        <Link prefetch={false} href="/objetivos" className="text-sm text-primary hover:underline">
          Ver todos{data.length > 3 ? ` (${data.length})` : ""}
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {primeros.map((o) => (
          <TarjetaObjetivo key={o.id} o={o} compacta />
        ))}
      </div>
    </section>
  );
}
