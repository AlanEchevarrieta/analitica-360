"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatoPesos } from "@/lib/formato";
import {
  etiquetaAjuste,
  precioConLista,
  REDONDEOS_LISTA,
  useEliminarListaPrecio,
  useGuardarListaPrecio,
  useListasPrecios,
  type DatosListaPrecio,
  type ListaPrecio,
} from "@/features/listas-precios/listas-precios";

const error = (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo guardar");
const selectClase = "h-8 rounded-lg border bg-transparent px-2";
const VACIA = { nombre: "", ajuste: "", redondeo: 100 };

/** Convierte lo escrito ("-15", "15,5") a número; null si no es válido. */
function aAjuste(texto: string): number | null {
  const n = Number(texto.trim().replace(",", "."));
  return texto.trim() && Number.isFinite(n) && n !== 0 ? n : null;
}

/** Listas de precios (mayorista, revendedor…): % sobre el precio normal, se asignan a cada cliente. */
export function ListasPreciosConfig() {
  const listas = useListasPrecios();
  const guardar = useGuardarListaPrecio();
  const [nueva, setNueva] = useState(VACIA);
  const ajuste = aAjuste(nueva.ajuste);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Asignale una lista a cada cliente (en su ficha) y al venderle los precios se ajustan solos. Usá un número negativo para descuento: <b>-15</b> = 15% menos que el precio normal.
      </p>
      {(listas.data ?? []).map((l) => (
        <FilaLista key={`${l.id}-${l.nombre}-${l.ajustePct}-${l.redondeo}`} lista={l} />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-48" placeholder="Nombre (ej. Mayorista)" aria-label="Nombre de la nueva lista" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
        <Input className="w-24" inputMode="decimal" placeholder="ej. -15" aria-label="Ajuste de la nueva lista (%)" value={nueva.ajuste} onChange={(e) => setNueva({ ...nueva, ajuste: e.target.value })} />
        <span className="text-muted-foreground">%</span>
        <select className={selectClase} aria-label="Redondeo de la nueva lista" value={nueva.redondeo} onChange={(e) => setNueva({ ...nueva, redondeo: Number(e.target.value) })}>
          {REDONDEOS_LISTA.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.etiqueta}
            </option>
          ))}
        </select>
        <Button
          disabled={!nueva.nombre.trim() || ajuste == null || guardar.isPending}
          onClick={() =>
            guardar.mutate(
              { id: null, datos: { nombre: nueva.nombre.trim(), ajustePct: ajuste!, redondeo: nueva.redondeo } },
              { onSuccess: () => (setNueva(VACIA), toast.success("Lista creada")), onError: error },
            )
          }
        >
          Agregar
        </Button>
      </div>
      {ajuste != null && (
        <p className="text-xs text-muted-foreground">
          Ejemplo: un producto de {formatoPesos(10_000)} queda en {formatoPesos(precioConLista(10_000, { ajustePct: ajuste, redondeo: nueva.redondeo }))} ({etiquetaAjuste(ajuste)}).
        </p>
      )}
    </div>
  );
}

function FilaLista({ lista }: { lista: ListaPrecio }) {
  const guardar = useGuardarListaPrecio();
  const eliminar = useEliminarListaPrecio();
  const [nombre, setNombre] = useState(lista.nombre);
  const [ajuste, setAjuste] = useState(String(lista.ajustePct));
  const [redondeo, setRedondeo] = useState(lista.redondeo);
  const pct = aAjuste(ajuste);
  const cambio = nombre.trim() !== lista.nombre || pct !== lista.ajustePct || redondeo !== lista.redondeo;
  const datos = (): DatosListaPrecio => ({ nombre: nombre.trim(), ajustePct: pct!, redondeo });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input className="max-w-48" aria-label={`Nombre de la lista ${lista.nombre}`} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Input className="w-24" inputMode="decimal" aria-label={`Ajuste de ${lista.nombre} (%)`} value={ajuste} onChange={(e) => setAjuste(e.target.value)} />
      <span className="text-muted-foreground">%</span>
      <select className={selectClase} aria-label={`Redondeo de ${lista.nombre}`} value={redondeo} onChange={(e) => setRedondeo(Number(e.target.value))}>
        {REDONDEOS_LISTA.map((r) => (
          <option key={r.valor} value={r.valor}>
            {r.etiqueta}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground">
        {lista.clientes} {lista.clientes === 1 ? "cliente" : "clientes"}
      </span>
      {cambio && (
        <Button size="sm" variant="outline" disabled={!nombre.trim() || pct == null || guardar.isPending} onClick={() => guardar.mutate({ id: lista.id, datos: datos() }, { onSuccess: () => toast.success("Guardado"), onError: error })}>
          Guardar
        </Button>
      )}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Eliminar ${lista.nombre}`}
        onClick={() =>
          window.confirm(`¿Eliminar la lista "${lista.nombre}"? ${lista.clientes ? `Sus ${lista.clientes} clientes vuelven al precio normal. ` : ""}Las ventas ya hechas no cambian.`) &&
          eliminar.mutate(lista.id, { onSuccess: () => toast.success("Lista eliminada"), onError: error })
        }
      >
        <Trash2 />
      </Button>
    </div>
  );
}
