"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { formatoFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { CATEGORIAS, ESTADOS, PRIORIDADES } from "@/features/soporte/hooks/use-soporte";
import { EstadoTicketBadge } from "@/features/soporte/components/TicketsListado";
import { useAccionesAdmin, useTicketAdmin, useTicketsAdmin } from "../hooks/use-admin";
import { Panel } from "./comunes";

const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";
const ORDEN_PRIORIDAD = ["urgente", "alta", "media", "baja"];

export function SoporteAdminVista() {
  const { data, isPending, isError, error, refetch } = useTicketsAdmin();
  const [estado, setEstado] = useState("pendientes");
  const [prioridad, setPrioridad] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (data ?? [])
      .filter((t) => (estado === "pendientes" ? t.estado === "abierto" || t.estado === "en_proceso" : !estado || t.estado === estado))
      .filter((t) => !prioridad || t.prioridad === prioridad)
      .filter((t) => !q || t.empresaNombre.toLowerCase().includes(q) || t.asunto.toLowerCase().includes(q) || (t.numeroTicket ?? "").toLowerCase().includes(q))
      .sort((a, b) => ORDEN_PRIORIDAD.indexOf(a.prioridad) - ORDEN_PRIORIDAD.indexOf(b.prioridad) || b.createdAt.localeCompare(a.createdAt));
  }, [data, estado, prioridad, busqueda]);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Soporte</h1>
        <p className="text-sm text-muted-foreground">Consultas de todos los clientes. Primero los urgentes.</p>
      </div>
      <Panel
        titulo={`${lista.length} tickets`}
        accion={
          <div className="flex flex-wrap gap-2">
            <select className={selectClase} aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="pendientes">Pendientes (abiertos y en proceso)</option>
              {Object.entries(ESTADOS).map(([v, e]) => (
                <option key={v} value={v}>
                  {e.etiqueta}
                </option>
              ))}
              <option value="">Todos</option>
            </select>
            <select className={selectClase} aria-label="Prioridad" value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
              <option value="">Toda prioridad</option>
              {Object.entries(PRIORIDADES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <Input className="w-48" placeholder="Cliente, asunto o N°" aria-label="Buscar ticket" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        }
      >
        {isPending ? (
          <CargandoFilas filas={5} />
        ) : isError ? (
          <ErrorDatos error={error} onReintentar={() => refetch()} />
        ) : lista.length === 0 ? (
          <SinDatos mensaje="No hay tickets con estos filtros." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Asunto</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="tabular-nums">
                    <Link prefetch={false} href={`/admin/soporte/${t.id}`} className="font-medium hover:underline">
                      {t.numeroTicket ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link prefetch={false} href={`/admin/clientes/${t.empresaId}`} className="hover:underline">
                      {t.empresaNombre}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-80 truncate">
                    <Link prefetch={false} href={`/admin/soporte/${t.id}`} className="hover:underline">
                      {t.asunto}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{CATEGORIAS[t.categoria as keyof typeof CATEGORIAS] ?? t.categoria}</span>
                  </TableCell>
                  <TableCell className={cn(t.prioridad === "urgente" && "font-medium text-red-400", t.prioridad === "alta" && "text-amber-400")}>
                    {PRIORIDADES[t.prioridad as keyof typeof PRIORIDADES] ?? t.prioridad}
                  </TableCell>
                  <TableCell>
                    <EstadoTicketBadge estado={t.estado as keyof typeof ESTADOS} />
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{formatoFechaHora(t.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </>
  );
}

export function TicketAdminVista({ id }: { id: string }) {
  const { data: t, isPending, isError, error, refetch } = useTicketAdmin(id);
  const { responderTicket, estadoTicket } = useAccionesAdmin();
  const [texto, setTexto] = useState("");
  if (isPending) return <CargandoFilas filas={6} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;

  const mensajes = [{ id: "inicial", esAdmin: false, contenido: t.descripcion, createdAt: t.createdAt }, ...t.respuestas];
  const enviar = () =>
    responderTicket.mutate(
      { id, contenido: texto.trim() },
      { onSuccess: () => (setTexto(""), toast.success("Respuesta enviada: el cliente ve el aviso en su menú")), onError: (e) => toast.error(e.message) },
    );

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/admin/soporte" className="text-xs text-muted-foreground hover:text-foreground">
        ← Soporte
      </Link>
      <Panel
        titulo={`${t.numeroTicket ?? ""} · ${t.asunto}`}
        descripcion={`${t.empresaNombre} · ${t.usuarioNombre ?? ""}${t.usuarioEmail ? ` (${t.usuarioEmail})` : ""} · ${CATEGORIAS[t.categoria as keyof typeof CATEGORIAS] ?? t.categoria} · prioridad ${(PRIORIDADES[t.prioridad as keyof typeof PRIORIDADES] ?? t.prioridad).toLowerCase()}`}
        accion={
          <select
            className={selectClase}
            aria-label="Estado del ticket"
            value={t.estado}
            onChange={(e) => estadoTicket.mutate({ id, estado: e.target.value }, { onSuccess: () => toast.success("Estado actualizado") })}
          >
            {Object.entries(ESTADOS).map(([v, e]) => (
              <option key={v} value={v}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        }
      >
        <div className="flex flex-col gap-3">
          {mensajes.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-1", m.esAdmin ? "items-end" : "items-start")}>
              <div className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap", m.esAdmin ? "bg-primary text-primary-foreground" : "bg-muted")}>{m.contenido}</div>
              <span className="text-xs text-muted-foreground">
                {m.esAdmin ? "Soporte (vos)" : t.empresaNombre} · {formatoFechaHora(m.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </Panel>
      {t.estado === "cerrado" ? (
        <p className="text-sm text-muted-foreground">Ticket cerrado. Cambiá el estado para volver a responder.</p>
      ) : (
        <Panel titulo="Responder como Soporte">
          <div className="flex flex-col gap-2">
            <textarea
              className="min-h-24 rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Escribí la respuesta para el cliente…"
              aria-label="Respuesta de soporte"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <Button className="self-end" onClick={enviar} disabled={responderTicket.isPending || !texto.trim()}>
              {responderTicket.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Enviar respuesta
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
