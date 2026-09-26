"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoFechaHora, formatoPesos } from "@/lib/formato";
import { TIPOS_INTERACCION, linkWhatsApp, useAccionesClientes, useCliente } from "../hooks/use-clientes";
import { ClienteForm } from "./ClienteForm";

export function ClienteFichaVista({ id }: { id: string }) {
  const { data: c, isPending, isError, error, refetch } = useCliente(id);
  const { interaccion } = useAccionesClientes();
  const [editando, setEditando] = useState(false);
  const [tipo, setTipo] = useState<keyof typeof TIPOS_INTERACCION>("nota");
  const [texto, setTexto] = useState("");

  if (isPending) return <CargandoFilas filas={6} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  const wa = linkWhatsApp(c.telefono, `Hola ${c.nombre.split(" ")[0]}!`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{c.nombre}</h1>
        {c.etiquetas.map((e) => (
          <span key={e} className="rounded bg-muted px-2 py-0.5 text-xs">
            {e}
          </span>
        ))}
        <div className="ml-auto flex gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <MessageCircle aria-hidden /> WhatsApp
            </a>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditando((x) => !x)}>
            {editando ? "Cancelar" : "Editar"}
          </Button>
        </div>
      </div>

      {editando ? (
        <Card>
          <CardContent>
            <ClienteForm inicial={c} onHecho={() => setEditando(false)} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-4 text-sm">
          <p>📞 {c.telefono ?? "—"}</p>
          <p>✉️ {c.email ?? "—"}</p>
          <p>🎂 {c.cumpleanos ? c.cumpleanos.split("-").reverse().join("/") : "—"}</p>
          <p>
            {c.cantidadCompras} compras · {formatoPesos(c.totalGastado)}
          </p>
          {c.notasLibres && <p className="sm:col-span-4 rounded-md bg-muted/50 p-2">{c.notasLibres}</p>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compras</CardTitle>
          </CardHeader>
          <CardContent>
            {c.ventas.length === 0 ? (
              <SinDatos mensaje="Sin compras vinculadas. Elegí este cliente al cargar una venta." />
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {c.ventas.map((v) => (
                  <li key={v.id} className="flex gap-3 py-2">
                    <Link prefetch={false} href={`/ventas/${v.id}`} className="w-36 shrink-0 tabular-nums hover:underline">
                      {formatoFechaHora(v.fecha)}
                    </Link>
                    <span className="flex-1 truncate text-muted-foreground">{v.productos}</span>
                    <span className="font-medium tabular-nums">{formatoPesos(v.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notas e historial</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2">
              <select className="h-8 rounded-lg border bg-transparent px-2 text-sm" aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
                {Object.entries(TIPOS_INTERACCION).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <Input placeholder="Ej: prefiere mates de calabaza" aria-label="Nota" value={texto} onChange={(e) => setTexto(e.target.value)} />
              <Button
                disabled={!texto.trim() || interaccion.isPending}
                onClick={() =>
                  interaccion.mutate(
                    { id, tipo, contenido: texto.trim() },
                    { onSuccess: () => setTexto(""), onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar") },
                  )
                }
              >
                Agregar
              </Button>
            </div>
            {c.interacciones.length === 0 ? (
              <SinDatos mensaje="Sin notas todavía." />
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {c.interacciones.map((i) => (
                  <li key={i.id} className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">
                      {TIPOS_INTERACCION[i.tipo] ?? i.tipo} · {formatoFechaHora(i.createdAt)}
                    </p>
                    <p>{i.contenido}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
