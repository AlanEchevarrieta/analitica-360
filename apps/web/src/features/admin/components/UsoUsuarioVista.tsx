"use client";

import Link from "next/link";
import { ArrowLeft, Eye, MousePointerClick } from "lucide-react";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoFechaHora, formatoNumero } from "@/lib/formato";
import { nombrePantalla, useUsoDeUsuario, type FiltrosUso } from "../hooks/use-uso";
import { Panel } from "./comunes";

/** Consola → Uso → un usuario: sus pantallas, sus clics y lo último que hizo. */
export function UsoUsuarioVista({ id, dias }: { id: string; dias: FiltrosUso["dias"] }) {
  const { data, isPending, isError, error, refetch } = useUsoDeUsuario(id, dias);
  if (isPending) return <CargandoFilas filas={8} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  const u = data.usuario;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/admin/uso" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Uso de la app
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{u?.nombre || u?.email || "Usuario"}</h1>
        {u && (
          <p className="text-sm text-muted-foreground">
            {u.email} · {u.empresa} · {u.rol} · últimos {dias === 1 ? "hoy" : `${dias} días`}
          </p>
        )}
      </div>

      {data.recientes.length === 0 ? (
        <SinDatos mensaje="No usó la app en este período." />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel titulo="Pantallas que abre">
              <ul className="flex flex-col gap-1.5 text-sm">
                {data.pantallas.map((p) => (
                  <li key={p.ruta} className="flex justify-between gap-2">
                    <span className="truncate">{nombrePantalla(p.ruta)}</span>
                    <b className="tabular-nums">{formatoNumero(p.vistas)}</b>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel titulo="Lo que toca">
              <ul className="flex flex-col gap-1.5 text-sm">
                {data.clics.map((c) => (
                  <li key={`${c.ruta}|${c.objetivo}`} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {c.objetivo} <span className="text-xs text-muted-foreground">en {nombrePantalla(c.ruta)}</span>
                    </span>
                    <b className="tabular-nums">{formatoNumero(c.veces)}</b>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <Panel titulo="Recorrido" descripcion="Lo último que hizo, del más nuevo al más viejo (hasta 300)">
            <ol className="flex flex-col text-sm">
              {data.recientes.map((r, i) => (
                <li key={i} className="flex items-start gap-3 border-b py-1.5 last:border-0">
                  <span className="w-36 shrink-0 tabular-nums text-xs text-muted-foreground">{formatoFechaHora(r.fecha)}</span>
                  {r.tipo === "vista" ? (
                    <Eye className="mt-0.5 size-4 shrink-0 text-sky-500" aria-label="Abrió" />
                  ) : (
                    <MousePointerClick className="mt-0.5 size-4 shrink-0 text-amber-500" aria-label="Tocó" />
                  )}
                  <span className="min-w-0">
                    {r.tipo === "vista" ? (
                      <>Abrió <b>{nombrePantalla(r.ruta)}</b></>
                    ) : (
                      <>
                        Tocó <b>{r.objetivo}</b> <span className="text-muted-foreground">en {nombrePantalla(r.ruta)}</span>
                      </>
                    )}
                    {r.dispositivo === "celular" && " 📱"}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </>
      )}
    </div>
  );
}
