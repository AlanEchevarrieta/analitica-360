"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CargandoFilas, ErrorDatos, SinDatos } from "@/components/shared/estado-datos";
import { Paginacion } from "@/components/shared/paginacion";
import { SelectorPeriodo, useRangoFechas } from "@/components/shared/selector-periodo";
import { useApiFetch } from "@/hooks/use-api";
import { descargarCsv } from "@/lib/csv";
import { formatoFechaHora, formatoPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";

// Espejo de GET /auditoria y /admin/auditoria (apps/api modules/auditoria).
export interface EventoBitacora {
  id: string;
  fecha: string;
  empresa?: string | null;
  actor: string;
  actorTipo: string;
  accion: "crear" | "editar" | "borrar" | "restaurar" | "anular";
  entidad: string;
  entidadNombre: string;
  nombre: string | null;
  resumen: string;
  cambios: Record<string, [unknown, unknown]> | null;
  ip: string | null;
}
interface Respuesta {
  total: number;
  items: EventoBitacora[];
}

const POR_PAGINA = 50;
const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";
const ACCIONES = [
  { valor: "", etiqueta: "Todas las acciones" },
  { valor: "crear", etiqueta: "Altas" },
  { valor: "editar", etiqueta: "Cambios" },
  { valor: "borrar", etiqueta: "Bajas" },
  { valor: "anular", etiqueta: "Anulaciones" },
  { valor: "restaurar", etiqueta: "Restauraciones" },
];
const ENTIDADES = [
  ["", "Todo"],
  ["Producto", "Productos"],
  ["Venta", "Ventas"],
  ["Anulacion", "Anulaciones"],
  ["MovimientoInventario", "Ajustes de stock"],
  ["Cliente", "Clientes"],
  ["Proveedor", "Proveedores"],
  ["Compra", "Compras"],
  ["Pedido", "Pedidos"],
  ["Gasto", "Gastos"],
  ["MovimientoFinanciero", "Caja"],
  ["CobroCliente", "Cobros"],
  ["Usuario", "Equipo"],
  ["ConfiguracionEmpresa", "Configuración"],
  ["ListaPrecio", "Listas de precios"],
] as const;
const COLOR: Record<EventoBitacora["accion"], string> = {
  crear: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  editar: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  borrar: "bg-red-500/15 text-red-700 dark:text-red-300",
  anular: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  restaurar: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
};
const ETIQUETA_ACCION: Record<EventoBitacora["accion"], string> = { crear: "Alta", editar: "Cambio", borrar: "Baja", anular: "Anulación", restaurar: "Restauración" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const legible = (v: unknown, c = "") => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (typeof v === "number" && /precio|costo|monto|total|saldo|importe/i.test(c)) return formatoPesos(v);
  if (typeof v === "string" && UUID.test(v)) return `…${v.slice(-6)}`;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return formatoFechaHora(v);
  return typeof v === "object" ? JSON.stringify(v) : String(v);
};
const campo = (c: string) => c.replace(/Id$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

function Cambios({ cambios }: { cambios: NonNullable<EventoBitacora["cambios"]> }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1 pr-3 font-medium">Campo</th>
          <th className="py-1 pr-3 font-medium">Antes</th>
          <th className="py-1 font-medium">Después</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(cambios).map(([k, [a, d]]) => (
          <tr key={k} className="border-t align-top">
            <td className="py-1 pr-3 whitespace-nowrap">{campo(k)}</td>
            <td className="py-1 pr-3 break-all text-red-600 line-through decoration-red-400/50 dark:text-red-400">{legible(a, k)}</td>
            <td className="py-1 break-all text-emerald-700 dark:text-emerald-400">{legible(d, k)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Bitácora de auditoría: quién cambió qué y cuándo, con el antes y el después.
 * `ruta` = "/auditoria" (el dueño, su empresa) o "/admin/auditoria" (consola, todas).
 */
export function BitacoraAuditoria({ ruta, empresaId }: { ruta: "/auditoria" | "/admin/auditoria"; empresaId?: string }) {
  const periodo = useRangoFechas("semana");
  const [f, setF] = useState({ actorUsuarioId: "", entidad: "", accion: "", busqueda: "", pagina: 1 });
  const [abierto, setAbierto] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const cambiar = (c: Partial<typeof f>) => setF((v) => ({ ...v, pagina: 1, ...c }));
  const api = useApiFetch();
  const { orgId } = useAuth();

  const consulta = (pagina: number, pageSize: number) => {
    const q = new URLSearchParams({ desde: periodo.desde, hasta: periodo.hasta, pagina: String(pagina), pageSize: String(pageSize) });
    for (const k of ["actorUsuarioId", "entidad", "accion"] as const) if (f[k]) q.set(k, f[k]);
    if (f.busqueda.trim()) q.set("busqueda", f.busqueda.trim());
    if (empresaId) q.set("empresaId", empresaId);
    return `${ruta}?${q}`;
  };
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["bitacora", ruta, orgId, empresaId, periodo.desde, periodo.hasta, f],
    queryFn: () => api<Respuesta>(consulta(f.pagina, POR_PAGINA)),
    enabled: Boolean(orgId),
    placeholderData: keepPreviousData,
  });
  const actores = useQuery({
    queryKey: ["bitacora-actores", ruta, orgId],
    queryFn: () => api<{ id: string; nombre: string }[]>(`${ruta}/actores`),
    enabled: Boolean(orgId),
    staleTime: 5 * 60_000,
  });

  async function exportar() {
    setExportando(true);
    try {
      const r = await api<Respuesta>(consulta(1, 5000));
      if (r.items.length === 0) return toast.info("No hay nada para exportar.");
      descargarCsv(
        `auditoria-${periodo.desde}-a-${periodo.hasta}`,
        r.items.map((e) => ({
          Fecha: formatoFechaHora(e.fecha),
          ...(e.empresa !== undefined ? { Empresa: e.empresa ?? "" } : {}),
          Quién: e.actor,
          Acción: ETIQUETA_ACCION[e.accion],
          Qué: e.entidadNombre,
          Detalle: e.resumen,
          Cambios: e.cambios ? Object.entries(e.cambios).map(([k, [a, d]]) => `${campo(k)}: ${legible(a, k)} → ${legible(d, k)}`).join(" | ") : "",
          IP: e.ip ?? "",
        })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SelectorPeriodo periodo={periodo} />
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder="Buscar (ej. precio, Mochila)" aria-label="Buscar en la bitácora" value={f.busqueda} onChange={(e) => cambiar({ busqueda: e.target.value })} />
        <select className={selectClase} aria-label="Persona" value={f.actorUsuarioId} onChange={(e) => cambiar({ actorUsuarioId: e.target.value })}>
          <option value="">Todas las personas</option>
          {(actores.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
        <select className={selectClase} aria-label="Qué" value={f.entidad} onChange={(e) => cambiar({ entidad: e.target.value })}>
          {ENTIDADES.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
        <select className={selectClase} aria-label="Acción" value={f.accion} onChange={(e) => cambiar({ accion: e.target.value })}>
          {ACCIONES.map((a) => (
            <option key={a.valor} value={a.valor}>
              {a.etiqueta}
            </option>
          ))}
        </select>
        <Button variant="outline" className="sm:ml-auto" onClick={() => void exportar()} disabled={exportando || !data?.total}>
          {exportando ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />} Exportar
        </Button>
      </div>

      {isPending ? (
        <CargandoFilas filas={8} />
      ) : isError ? (
        <ErrorDatos error={error} onReintentar={() => refetch()} />
      ) : data.items.length === 0 ? (
        <SinDatos mensaje="No hay cambios registrados con estos filtros." />
      ) : (
        <div className={cn("flex flex-col", isFetching && "opacity-60 transition-opacity")}>
          <ol className="flex flex-col divide-y rounded-xl border">
            {data.items.map((e) => (
              <li key={e.id}>
                  <button
                    type="button"
                    data-rastreo="Ver detalle de auditoría"
                    disabled={!e.cambios}
                    onClick={() => setAbierto(abierto === e.id ? null : e.id)}
                    aria-expanded={abierto === e.id}
                    className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted/50 disabled:hover:bg-transparent"
                  >
                    <span className={cn("mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium", COLOR[e.accion])}>{ETIQUETA_ACCION[e.accion]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">
                        <b>{e.actor}</b> {e.resumen}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatoFechaHora(e.fecha)}
                        {e.empresa ? ` · ${e.empresa}` : ""}
                        {e.ip ? ` · IP ${e.ip}` : ""}
                      </span>
                    </span>
                    {e.cambios && <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", abierto === e.id && "rotate-180")} aria-hidden />}
                  </button>
                  {abierto === e.id && e.cambios && (
                    <div className="px-3 pb-3 sm:pl-24">
                      <Cambios cambios={e.cambios} />
                    </div>
                  )}
              </li>
            ))}
          </ol>
          <div className="mt-3">
            <Paginacion pagina={f.pagina} porPagina={POR_PAGINA} total={data.total} onCambiar={(pagina) => setF((v) => ({ ...v, pagina }))} />
          </div>
        </div>
      )}
    </div>
  );
}
