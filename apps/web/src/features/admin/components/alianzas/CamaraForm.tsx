"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CamaraDatos, TramoComision } from "../../hooks/use-alianzas";

/** Valores de la UCIM: un buen punto de partida para una cámara nueva. */
export const TRAMOS_POR_DEFECTO: TramoComision[] = [
  { desde: 1, hasta: 50, porcentaje: 20 },
  { desde: 51, hasta: 75, porcentaje: 25 },
  { desde: 76, hasta: 100, porcentaje: 30 },
  { desde: 101, hasta: 150, porcentaje: 35 },
  { desde: 151, hasta: null, porcentaje: 40 },
];

export const CAMARA_VACIA: CamaraDatos = {
  nombre: "",
  contactoNombre: null,
  contactoEmail: null,
  contactoTelefono: null,
  activa: true,
  mesesComision: 24,
  tramos: TRAMOS_POR_DEFECTO,
  notas: null,
};

/** Los tramos se editan con su "hasta"; el "desde" de cada uno sigue al anterior. */
function encadenar(tramos: TramoComision[]): TramoComision[] {
  return tramos.map((t, i) => ({ ...t, desde: i === 0 ? 1 : (tramos[i - 1].hasta ?? 0) + 1, hasta: i === tramos.length - 1 ? null : t.hasta }));
}

export function CamaraForm({ inicial, guardando, onGuardar, onCancelar }: { inicial: CamaraDatos; guardando: boolean; onGuardar: (d: CamaraDatos) => void; onCancelar?: () => void }) {
  const [d, setD] = useState<CamaraDatos>(inicial);
  const set = (cambios: Partial<CamaraDatos>) => setD((v) => ({ ...v, ...cambios }));
  const setTramo = (i: number, cambios: Partial<TramoComision>) => set({ tramos: encadenar(d.tramos.map((t, j) => (j === i ? { ...t, ...cambios } : t))) });

  function guardar() {
    if (d.nombre.trim().length < 2) return toast.error("Poné el nombre de la cámara.");
    const malos = d.tramos.some((t) => t.hasta != null && t.hasta < t.desde);
    if (malos) return toast.error("Revisá los tramos: cada uno tiene que terminar después de donde empieza.");
    onGuardar({ ...d, tramos: encadenar(d.tramos) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cam-nombre">Nombre</Label>
          <Input id="cam-nombre" value={d.nombre} onChange={(e) => set({ nombre: e.target.value })} placeholder="Ej. UCIM" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cam-meses">Meses de comisión por cliente</Label>
          <Input id="cam-meses" type="number" min={1} max={120} value={d.mesesComision} onChange={(e) => set({ mesesComision: Number(e.target.value) || 1 })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cam-contacto">Contacto</Label>
          <Input id="cam-contacto" value={d.contactoNombre ?? ""} onChange={(e) => set({ contactoNombre: e.target.value || null })} placeholder="Nombre de la persona" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cam-email">Email</Label>
          <Input id="cam-email" type="email" value={d.contactoEmail ?? ""} onChange={(e) => set({ contactoEmail: e.target.value || null })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cam-tel">Teléfono</Label>
          <Input id="cam-tel" value={d.contactoTelefono ?? ""} onChange={(e) => set({ contactoTelefono: e.target.value || null })} />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={d.activa} onChange={(e) => set({ activa: e.target.checked })} />
          Activa (sus códigos se pueden usar)
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Comisión según el número de cliente (escalonada, no retroactiva)</span>
        {d.tramos.map((t, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24 tabular-nums text-muted-foreground">Del {t.desde}</span>
            {t.hasta == null ? (
              <span className="w-28 text-muted-foreground">en adelante</span>
            ) : (
              <span className="flex items-center gap-1">
                al
                <Input className="h-8 w-20" type="number" min={t.desde} aria-label={`Hasta el cliente (tramo ${i + 1})`} value={t.hasta} onChange={(e) => setTramo(i, { hasta: Number(e.target.value) || t.desde })} />
              </span>
            )}
            <span className="flex items-center gap-1">
              →
              <Input className="h-8 w-20" type="number" min={0} max={100} aria-label={`Porcentaje (tramo ${i + 1})`} value={t.porcentaje} onChange={(e) => setTramo(i, { porcentaje: Number(e.target.value) })} />%
            </span>
            {d.tramos.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => set({ tramos: encadenar(d.tramos.filter((_, j) => j !== i)) })}>
                Quitar
              </Button>
            )}
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="w-fit"
          onClick={() => {
            const ultimo = d.tramos[d.tramos.length - 1];
            const previos = d.tramos.slice(0, -1);
            set({ tramos: encadenar([...previos, { ...ultimo, hasta: ultimo.desde + 49 }, { desde: 0, hasta: null, porcentaje: ultimo.porcentaje }]) });
          }}
        >
          Agregar tramo
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cam-notas">Notas</Label>
        <textarea id="cam-notas" className="min-h-16 rounded-lg border bg-transparent px-2.5 py-1.5 text-sm" value={d.notas ?? ""} onChange={(e) => set({ notas: e.target.value || null })} />
      </div>

      <div className="flex gap-2">
        <Button onClick={guardar} disabled={guardando}>
          Guardar
        </Button>
        {onCancelar && (
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
