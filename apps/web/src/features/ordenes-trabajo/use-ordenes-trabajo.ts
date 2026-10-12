"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

// Espejo de apps/api modules/ordenes-trabajo.
export type EstadoOt = "recibido" | "en_proceso" | "listo" | "entregado" | "cancelada";

export const ETAPAS: { id: EstadoOt; nombre: string }[] = [
  { id: "recibido", nombre: "Recibido" },
  { id: "en_proceso", nombre: "En proceso" },
  { id: "listo", nombre: "Listo para retirar" },
  { id: "entregado", nombre: "Entregado" },
];
export const NOMBRE_ESTADO_OT: Record<EstadoOt, string> = { recibido: "Recibido", en_proceso: "En proceso", listo: "Listo para retirar", entregado: "Entregado", cancelada: "Cancelada" };
export const COLOR_ESTADO_OT: Record<EstadoOt, string> = {
  recibido: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  en_proceso: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  listo: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  entregado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelada: "bg-muted text-muted-foreground",
};

export interface OrdenTrabajoFila {
  id: string;
  numero: string;
  estado: EstadoOt;
  clienteNombre: string | null;
  equipo: string;
  responsable: string | null;
  fechaPrometida: string | null;
  createdAt: string;
  total: number;
  senia: number;
}

export interface OrdenTrabajoFicha {
  id: string;
  numero: string;
  estado: EstadoOt;
  clienteId: string | null;
  clienteNombre: string | null;
  clienteTelefono: string | null;
  cliente: { nombre: string; telefono: string | null; email: string | null } | null;
  equipo: string;
  problema: string | null;
  notasInternas: string | null;
  responsableId: string | null;
  responsable: string | null;
  fechaPrometida: string | null;
  descuento: number;
  items: { id: string; productoId: string; varianteId: string | null; descripcion: string; cantidad: number; precioUnitario: number; stock: number | null }[];
  subtotal: number;
  total: number;
  senia: { cobroId: string; monto: number; formaPago: string; fecha: string; recibo: string | null } | null;
  saldo: number;
  presupuestoId: string | null;
  ventaId: string | null;
  numeroVenta: string | null;
  entregadaEn: string | null;
  createdAt: string;
  historial: { estado: EstadoOt; fecha: string; usuario: string | null; nota: string | null }[];
}

export interface OrdenTrabajoInput {
  clienteId: string | null;
  clienteNombre: string | null;
  clienteTelefono: string | null;
  equipo: string;
  problema: string | null;
  notasInternas: string | null;
  responsableId: string | null;
  fechaPrometida: string | null;
  items: { productoId: string; varianteId: string | null; cantidad: number; precioUnitario: number }[];
  descuento: number;
  senia?: { monto: number; formaPago: string } | null;
}

function useConsulta<T>(clave: unknown[], ruta: string | null) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["ordenes-trabajo", ...clave, orgId], queryFn: () => api<T>(ruta!), enabled: Boolean(orgId && ruta) });
}

export const useOrdenesTrabajo = (estado: string) => useConsulta<OrdenTrabajoFila[]>(["lista", estado], `/ordenes-trabajo?estado=${encodeURIComponent(estado)}`);
export const useOrdenTrabajo = (id: string) => useConsulta<OrdenTrabajoFicha>(["ficha", id], `/ordenes-trabajo/${id}`);
export const useResponsables = () => useConsulta<{ id: string; nombre: string }[]>(["responsables"], "/ordenes-trabajo/responsables");

export function useAccionesOt() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const refrescar = (conVenta = false) => {
    for (const k of ["ordenes-trabajo", "presupuestos", ...(conVenta ? ["ventas", "venta", "productos", "dashboard", "cuenta-corriente"] : [])]) void queryClient.invalidateQueries({ queryKey: [k] });
  };
  const enviar = <T,>(ruta: string, body: unknown, method = "POST") => api<T>(ruta, { method, body: JSON.stringify(body) });
  return {
    crear: useMutation({ mutationFn: (d: OrdenTrabajoInput) => enviar<OrdenTrabajoFicha>("/ordenes-trabajo", d), onSuccess: () => refrescar() }),
    desdePresupuesto: useMutation({
      mutationFn: ({ presupuestoId, ...d }: { presupuestoId: string; equipo: string; problema: string | null; responsableId: string | null; fechaPrometida: string | null }) =>
        enviar<OrdenTrabajoFicha>(`/ordenes-trabajo/desde-presupuesto/${presupuestoId}`, d),
      onSuccess: () => refrescar(),
    }),
    editar: useMutation({ mutationFn: ({ id, ...d }: OrdenTrabajoInput & { id: string }) => enviar<OrdenTrabajoFicha>(`/ordenes-trabajo/${id}`, d, "PUT"), onSuccess: () => refrescar() }),
    estado: useMutation({ mutationFn: ({ id, estado, nota }: { id: string; estado: EstadoOt; nota?: string | null }) => enviar<OrdenTrabajoFicha>(`/ordenes-trabajo/${id}/estado`, { estado, nota }), onSuccess: () => refrescar() }),
    entregar: useMutation({
      mutationFn: ({ id, ...d }: { id: string; formaPago: string; cuotas?: number; coeficienteInteres?: number; ubicacionOrigen?: string | null }) => enviar<OrdenTrabajoFicha>(`/ordenes-trabajo/${id}/entregar`, d),
      onSuccess: () => refrescar(true),
    }),
    cancelar: useMutation({ mutationFn: ({ id, motivo }: { id: string; motivo: string }) => enviar<OrdenTrabajoFicha>(`/ordenes-trabajo/${id}/cancelar`, { motivo }), onSuccess: () => refrescar(true) }),
  };
}

/** Mensaje de WhatsApp según la etapa (mismo texto que la API). */
export function mensajeEtapa(o: OrdenTrabajoFicha, negocio: string) {
  const nombre = o.cliente?.nombre ?? o.clienteNombre;
  const saludo = `Hola${nombre ? ` ${nombre.split(" ")[0]}` : ""}!`;
  const que = `tu ${o.equipo} (orden ${o.numero})`;
  const texto: Record<EstadoOt, string> = {
    recibido: `Recibimos ${que}. Te avisamos cuando esté listo.`,
    en_proceso: `Ya estamos trabajando en ${que}.`,
    listo: `${que.charAt(0).toUpperCase()}${que.slice(1)} ya está listo para retirar${o.total ? `. Total: $${o.total.toLocaleString("es-AR")}${o.senia ? ` (ya dejaste $${o.senia.monto.toLocaleString("es-AR")} de seña)` : ""}` : ""}.`,
    entregado: `Gracias por retirar ${que}.`,
    cancelada: `Cancelamos la orden ${o.numero} de ${o.equipo}.`,
  };
  return `${saludo} ${texto[o.estado]}\n${negocio}`;
}
