"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApiFetch } from "@/hooks/use-api";
import type { AccionClave } from "@/hooks/use-acceso";
import type { ModuloClave } from "@/lib/rol";
import { cn } from "@/lib/utils";

interface Miembro {
  usuarioId: string;
  nombre: string;
  email: string;
  rol: "dueno" | "operador" | "contador";
  esYo: boolean;
  modulos: ModuloClave[];
  acciones: AccionClave[];
  personalizado: boolean;
}

const MODULOS: { id: ModuloClave; etiqueta: string }[] = [
  { id: "inicio", etiqueta: "Inicio" },
  { id: "ventas", etiqueta: "Ventas" },
  { id: "productos", etiqueta: "Productos" },
  { id: "clientes", etiqueta: "Clientes" },
  { id: "compras", etiqueta: "Compras" },
  { id: "proveedores", etiqueta: "Proveedores" },
  { id: "pedidos", etiqueta: "Pedidos" },
  { id: "inventario", etiqueta: "Inventario" },
  { id: "produccion", etiqueta: "Producción" },
  { id: "analytics", etiqueta: "Analytics" },
  { id: "insights", etiqueta: "Insights" },
  { id: "contabilidad", etiqueta: "Contabilidad" },
];

const ACCIONES: { id: AccionClave; etiqueta: string }[] = [
  { id: "registrar_ventas", etiqueta: "Registrar ventas" },
  { id: "anular_ventas", etiqueta: "Anular ventas" },
  { id: "gestionar_clientes", etiqueta: "Cargar y editar clientes" },
  { id: "crear_pedidos", etiqueta: "Crear pedidos" },
  { id: "hacer_picking", etiqueta: "Armar pedidos" },
  { id: "editar_productos", etiqueta: "Crear y editar productos y precios" },
  { id: "ver_costos", etiqueta: "Ver costos y ganancias" },
  { id: "importar_datos", etiqueta: "Importar desde Excel" },
  { id: "ver_reportes", etiqueta: "Ver reportes" },
];

const VENDEDOR = { modulos: ["inicio", "productos", "ventas", "clientes"] as ModuloClave[], acciones: ["registrar_ventas", "gestionar_clientes", "crear_pedidos"] as AccionClave[] };
const PERFILES: { nombre: string; detalle: string; modulos: ModuloClave[]; acciones: AccionClave[] }[] = [
  { nombre: "Vendedor", detalle: "Vende y atiende clientes, sin ver costos", ...VENDEDOR },
  {
    nombre: "Encargado",
    detalle: "Además compras, stock, pedidos, producción y reportes",
    modulos: [...VENDEDOR.modulos, "compras", "proveedores", "pedidos", "inventario", "produccion", "analytics"],
    acciones: [...VENDEDOR.acciones, "anular_ventas", "hacer_picking", "editar_productos", "ver_costos", "importar_datos", "ver_reportes"],
  },
  { nombre: "Todo", detalle: "Todo menos Configuración", modulos: MODULOS.map((m) => m.id), acciones: ACCIONES.map((a) => a.id) },
];

const iguales = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Qué ve y qué puede hacer cada persona del equipo (solo el dueño). */
export function PermisosEquipo() {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const equipo = useQuery({ queryKey: ["equipo", orgId], queryFn: () => api<Miembro[]>("/equipo"), enabled: Boolean(orgId) });
  if (!equipo.data) return null;
  return (
    <div className="flex flex-col gap-3">
      {equipo.data.map((m) => (
        <FilaMiembro key={`${m.usuarioId}-${m.modulos.join()}-${m.acciones.join()}`} miembro={m} />
      ))}
    </div>
  );
}

function FilaMiembro({ miembro }: { miembro: Miembro }) {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  const [modulos, setModulos] = useState<ModuloClave[]>(miembro.modulos.filter((m) => m !== "configuracion" && m !== "soporte"));
  const [acciones, setAcciones] = useState<AccionClave[]>(miembro.acciones);
  const guardar = useMutation({
    mutationFn: () => api(`/equipo/${miembro.usuarioId}/permisos`, { method: "PUT", body: JSON.stringify({ modulos, acciones }) }),
    onSuccess: () => {
      toast.success(`Permisos de ${miembro.nombre} guardados`);
      void queryClient.invalidateQueries({ queryKey: ["equipo"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });
  const alternar = <T extends string>(lista: T[], valor: T) => (lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);
  const originales = miembro.modulos.filter((m) => m !== "configuracion" && m !== "soporte");
  const cambio = !iguales(modulos, originales) || !iguales(acciones, miembro.acciones);

  const encabezado = (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-medium">{miembro.nombre}</span>
      {miembro.esYo && <span className="text-xs text-muted-foreground">(vos)</span>}
      <span className="text-xs text-muted-foreground">{miembro.email}</span>
      <span className={cn("rounded px-1.5 py-0.5 text-[11px]", miembro.rol === "dueno" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
        {miembro.rol === "dueno" ? "Dueño" : miembro.rol === "contador" ? "Contador" : "Colaborador"}
      </span>
    </div>
  );

  if (miembro.rol !== "operador") {
    return (
      <div className="rounded-lg p-3 text-sm ring-1 ring-foreground/10">
        {encabezado}
        <p className="mt-1 text-muted-foreground">{miembro.rol === "dueno" ? "Ve y configura todo." : "Solo lectura: ventas, compras, productos, analytics y contabilidad."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg p-3 text-sm ring-1 ring-foreground/10">
      {encabezado}
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Perfiles para ${miembro.nombre}`}>
        {PERFILES.map((p) => {
          const activo = iguales(modulos, p.modulos) && iguales(acciones, p.acciones);
          return (
            <button
              key={p.nombre}
              type="button"
              aria-pressed={activo}
              onClick={() => (setModulos(p.modulos), setAcciones(p.acciones))}
              className={cn("rounded-lg px-3 py-1.5 text-left ring-1 hover:bg-muted", activo ? "ring-2 ring-primary" : "ring-foreground/10")}
            >
              <span className="block font-medium">{p.nombre}</span>
              <span className="block text-xs text-muted-foreground">{p.detalle}</span>
            </button>
          );
        })}
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-medium text-muted-foreground">Qué secciones ve</legend>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          {MODULOS.map((m) => (
            <label key={m.id} className="flex items-center gap-2">
              <input type="checkbox" checked={modulos.includes(m.id)} onChange={() => setModulos((l) => alternar(l, m.id))} />
              {m.etiqueta}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-medium text-muted-foreground">Qué puede hacer</legend>
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-3">
          {ACCIONES.map((a) => (
            <label key={a.id} className="flex items-center gap-2">
              <input type="checkbox" checked={acciones.includes(a.id)} onChange={() => setAcciones((l) => alternar(l, a.id))} />
              {a.etiqueta}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={!cambio || guardar.isPending} onClick={() => guardar.mutate()}>
          {guardar.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Guardar permisos
        </Button>
        {!miembro.personalizado && !cambio && <span className="text-xs text-muted-foreground">Tiene los permisos iniciales (vendedor). Configuración siempre queda solo para vos.</span>}
        {cambio && <span className="text-xs text-amber-600 dark:text-amber-400">Cambios sin guardar</span>}
      </div>
    </div>
  );
}
