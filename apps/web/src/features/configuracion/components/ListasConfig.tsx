"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListaConfig, type AtributoConfig, type CategoriaConfig, type Ubicacion } from "../hooks/use-configuracion";

const error = (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo guardar");
const TIPOS: Record<Ubicacion["tipo"], string> = { deposito: "Depósito", local: "Local", stand: "Stand", feria: "Feria", otro: "Otro" };

export function UbicacionesConfig() {
  const { lista, guardar, eliminar } = useListaConfig<Ubicacion>("ubicaciones");
  const [nueva, setNueva] = useState({ nombre: "", tipo: "local" as Ubicacion["tipo"] });
  return (
    <div className="flex flex-col gap-2 text-sm">
      {(lista.data ?? []).map((u) => (
        <FilaEditable
          key={u.id}
          nombre={u.nombre}
          activo={u.activo}
          extra={TIPOS[u.tipo]}
          onGuardar={(nombre, activo) => guardar.mutate({ id: u.id, datos: { nombre, descripcion: u.descripcion, tipo: u.tipo, activo } }, { onSuccess: () => toast.success("Guardado"), onError: error })}
          onEliminar={() => eliminar.mutate(u.id, { onSuccess: () => toast.success("Eliminada"), onError: error })}
          ayudaEliminar="Solo se puede eliminar si no tiene movimientos de stock; si no, desactivala."
        />
      ))}
      <div className="flex gap-2">
        <Input className="max-w-xs" placeholder="Nueva ubicación (ej. Stand Parque)" aria-label="Nueva ubicación" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
        <select className="h-8 rounded-lg border bg-transparent px-2" aria-label="Tipo" value={nueva.tipo} onChange={(e) => setNueva({ ...nueva, tipo: e.target.value as Ubicacion["tipo"] })}>
          {Object.entries(TIPOS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <Button
          disabled={!nueva.nombre.trim()}
          onClick={() =>
            guardar.mutate(
              { id: null, datos: { nombre: nueva.nombre.trim(), descripcion: null, tipo: nueva.tipo, activo: true } },
              { onSuccess: () => setNueva({ ...nueva, nombre: "" }), onError: error },
            )
          }
        >
          Agregar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Si renombrás una ubicación, su stock y sus movimientos se mantienen.</p>
    </div>
  );
}

export function CategoriasConfig() {
  const { lista, guardar, eliminar } = useListaConfig<CategoriaConfig>("categorias");
  const [nombre, setNombre] = useState("");
  return (
    <div className="flex flex-col gap-2 text-sm">
      {(lista.data ?? []).map((c) => (
        <FilaEditable
          key={c.id}
          nombre={c.nombre}
          activo={c.activo}
          onGuardar={(n, activo) => guardar.mutate({ id: c.id, datos: { nombre: n, descripcion: c.descripcion, activo } }, { onSuccess: () => toast.success("Guardado"), onError: error })}
          onEliminar={() => eliminar.mutate(c.id, { onSuccess: () => toast.success("Eliminada"), onError: error })}
          ayudaEliminar="Los productos de esta categoría quedan sin categoría."
        />
      ))}
      <div className="flex gap-2">
        <Input className="max-w-xs" placeholder="Nueva categoría" aria-label="Nueva categoría" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Button disabled={!nombre.trim()} onClick={() => guardar.mutate({ id: null, datos: { nombre: nombre.trim(), descripcion: null, activo: true } }, { onSuccess: () => setNombre(""), onError: error })}>
          Agregar
        </Button>
      </div>
    </div>
  );
}

export function AtributosConfig() {
  const { lista, guardar, eliminar } = useListaConfig<AtributoConfig>("atributos");
  const [nuevo, setNuevo] = useState({ nombre: "", valores: "" });
  const valores = (t: string) => t.split(",").map((v) => v.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-3 text-sm">
      {(lista.data ?? []).map((a) => (
        <AtributoFila key={a.id} atributo={a} onGuardar={(datos) => guardar.mutate({ id: a.id, datos }, { onSuccess: () => toast.success("Guardado"), onError: error })} onEliminar={() => eliminar.mutate(a.id, { onError: error })} />
      ))}
      <div className="flex flex-wrap gap-2">
        <Input className="w-40" placeholder="Atributo (ej. Talle)" aria-label="Nuevo atributo" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <Input className="min-w-60 flex-1" placeholder="Valores separados por coma (S, M, L)" aria-label="Valores" value={nuevo.valores} onChange={(e) => setNuevo({ ...nuevo, valores: e.target.value })} />
        <Button
          disabled={!nuevo.nombre.trim() || valores(nuevo.valores).length === 0}
          onClick={() => guardar.mutate({ id: null, datos: { nombre: nuevo.nombre.trim(), valores: valores(nuevo.valores), activoVentas: true } }, { onSuccess: () => setNuevo({ nombre: "", valores: "" }), onError: error })}
        >
          Agregar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Son las sugerencias al cargar variantes. Si renombrás un atributo, se actualiza en todas las variantes.</p>
    </div>
  );
}

function AtributoFila({ atributo, onGuardar, onEliminar }: { atributo: AtributoConfig; onGuardar: (d: Omit<AtributoConfig, "id">) => void; onEliminar: () => void }) {
  const [nombre, setNombre] = useState(atributo.nombre);
  const [valores, setValores] = useState(atributo.valores.join(", "));
  const lista = valores.split(",").map((v) => v.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input className="w-40" aria-label="Nombre del atributo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Input className="min-w-60 flex-1" aria-label={`Valores de ${atributo.nombre}`} value={valores} onChange={(e) => setValores(e.target.value)} />
      <Button size="sm" variant="outline" disabled={!nombre.trim() || lista.length === 0} onClick={() => onGuardar({ nombre: nombre.trim(), valores: lista, activoVentas: atributo.activoVentas })}>
        Guardar
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${atributo.nombre}`} onClick={() => window.confirm(`¿Eliminar "${atributo.nombre}"? Las variantes existentes no cambian.`) && onEliminar()}>
        <Trash2 />
      </Button>
    </div>
  );
}

function FilaEditable({ nombre, activo, extra, onGuardar, onEliminar, ayudaEliminar }: { nombre: string; activo: boolean; extra?: string; onGuardar: (nombre: string, activo: boolean) => void; onEliminar: () => void; ayudaEliminar: string }) {
  const [valor, setValor] = useState(nombre);
  const [act, setAct] = useState(activo);
  const cambio = valor.trim() !== nombre || act !== activo;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${act ? "" : "opacity-60"}`}>
      <Input className="max-w-xs" aria-label="Nombre" value={valor} onChange={(e) => setValor(e.target.value)} />
      {extra && <span className="w-20 text-muted-foreground">{extra}</span>}
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={act} onChange={(e) => setAct(e.target.checked)} /> Activa
      </label>
      {cambio && (
        <Button size="sm" variant="outline" disabled={!valor.trim()} onClick={() => onGuardar(valor.trim(), act)}>
          Guardar
        </Button>
      )}
      <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${nombre}`} onClick={() => window.confirm(`¿Eliminar "${nombre}"? ${ayudaEliminar}`) && onEliminar()}>
        <Trash2 />
      </Button>
    </div>
  );
}
