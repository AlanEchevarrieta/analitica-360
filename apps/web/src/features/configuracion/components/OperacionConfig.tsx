"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useColaboradores } from "@/features/pedidos/hooks/use-pedidos";
import { useGuardarConfiguracion, useListaConfig, type Configuracion, type Ubicacion } from "../hooks/use-configuracion";

const aviso = { onSuccess: () => toast.success("Guardado"), onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo guardar") };
const SELECT = "h-8 rounded-lg border bg-transparent px-2 text-sm";

/** Flujo de ventas: si se pide el cliente y si se crea desde la venta. */
export function FlujoVentasConfig({ config }: { config: Configuracion }) {
  const guardar = useGuardarConfiguracion();
  const [mostrar, setMostrar] = useState(config.mostrarCliente);
  const [crear, setCrear] = useState(config.crearClienteDesdeVenta);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="font-medium">Cliente en la venta</p>
      {(
        [
          ["siempre", "Siempre", "Aparece y es obligatorio"],
          ["opcional", "Opcional", "Aparece pero se puede dejar vacío"],
          ["no_mostrar", "No mostrar", "El campo no aparece"],
        ] as const
      ).map(([v, l, nota]) => (
        <label key={v} className="flex items-center gap-2">
          <input type="radio" name="mostrar-cliente" checked={mostrar === v} onChange={() => setMostrar(v)} />
          {l} <span className="text-muted-foreground">— {nota}</span>
        </label>
      ))}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={crear} onChange={(e) => setCrear(e.target.checked)} />
        Crear el cliente automáticamente si no existe
      </label>
      <Button className="self-start" disabled={guardar.isPending} onClick={() => guardar.mutate({ mostrarCliente: mostrar, crearClienteDesdeVenta: crear }, aviso)}>
        Guardar
      </Button>
    </div>
  );
}

/** Inventario y pedidos: umbral de stock bajo, ubicación de venta y a quién se asignan los pedidos. */
export function InventarioPedidosConfig({ config }: { config: Configuracion }) {
  const guardar = useGuardarConfiguracion();
  const { lista: ubicaciones } = useListaConfig<Ubicacion>("ubicaciones");
  const colaboradores = useColaboradores();
  const [umbral, setUmbral] = useState(String(config.umbralStockBajo));
  const [ubicacion, setUbicacion] = useState(config.ubicacionVentaDefault ?? "");
  const [modo, setModo] = useState(config.modoAsignacion);
  const [fijo, setFijo] = useState(config.asignacionFijaUsuarioId ?? "");
  const [rotacion, setRotacion] = useState(config.asignacionRotacionIds);

  function onGuardar() {
    if (modo === "todo_a_uno" && !fijo) return toast.error("Elegí a quién se asignan los pedidos.");
    if (modo === "round_robin" && rotacion.length === 0) return toast.error("Elegí al menos una persona para la rotación.");
    guardar.mutate(
      {
        umbralStockBajo: Math.max(0, Number.parseInt(umbral, 10) || 0),
        ubicacionVentaDefault: ubicacion || null,
        modoAsignacion: modo,
        asignacionFijaUsuarioId: modo === "todo_a_uno" ? fijo : null,
        asignacionRotacionIds: modo === "round_robin" ? rotacion : [],
      },
      aviso,
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cfg-umbral">Alerta de stock bajo (unidades)</Label>
          <Input id="cfg-umbral" inputMode="numeric" value={umbral} onChange={(e) => setUmbral(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cfg-ubicacion">Ubicación de venta por defecto</Label>
          <select id="cfg-ubicacion" className={SELECT} value={ubicacion} onChange={(e) => setUbicacion(e.target.value)}>
            <option value="">La primera de la lista</option>
            {(ubicaciones.data ?? []).filter((u) => u.activo).map((u) => (
              <option key={u.id}>{u.nombre}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cfg-asignacion">Asignación de pedidos nuevos</Label>
        <select id="cfg-asignacion" className={SELECT} value={modo} onChange={(e) => setModo(e.target.value as typeof modo)}>
          <option value="manual">Manual (se asignan a mano)</option>
          <option value="round_robin">Rotación entre varias personas</option>
          <option value="todo_a_uno">Todos a una persona</option>
        </select>
      </div>
      {modo === "todo_a_uno" && (
        <select className={SELECT} aria-label="Persona" value={fijo} onChange={(e) => setFijo(e.target.value)}>
          <option value="">Elegí…</option>
          {(colaboradores.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      )}
      {modo === "round_robin" && (
        <div className="flex flex-wrap gap-3">
          {(colaboradores.data ?? []).map((c) => (
            <label key={c.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rotacion.includes(c.id)}
                onChange={(e) => setRotacion((r) => (e.target.checked ? [...r, c.id] : r.filter((x) => x !== c.id)))}
              />
              {c.nombre}
            </label>
          ))}
        </div>
      )}
      <Button className="self-start" disabled={guardar.isPending} onClick={onGuardar}>
        Guardar
      </Button>
    </div>
  );
}
