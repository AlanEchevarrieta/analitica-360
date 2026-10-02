"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NOMBRE_TIPO_CUPON, useCamaras, type CuponDatos } from "../../hooks/use-alianzas";
import { ReglasEditor } from "./ReglasEditor";

const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";

export const CUPON_VACIO: CuponDatos = {
  codigo: "",
  tipo: "camara",
  camaraId: null,
  descripcion: null,
  diasPrueba: null,
  reglas: {},
  desde: null,
  hasta: null,
  maxUsos: null,
  activo: true,
};

export function CuponForm({ inicial, guardando, onGuardar, onCancelar }: { inicial: CuponDatos; guardando: boolean; onGuardar: (d: CuponDatos) => void; onCancelar: () => void }) {
  const camaras = useCamaras();
  const [d, setD] = useState<CuponDatos>(inicial);
  const set = (cambios: Partial<CuponDatos>) => setD((v) => ({ ...v, ...cambios }));

  function guardar() {
    if (d.codigo.replace(/\s+/g, "").length < 3) return toast.error("El código tiene que tener al menos 3 caracteres.");
    if (d.tipo === "camara" && !d.camaraId) return toast.error("Elegí a qué cámara pertenece el código.");
    onGuardar({ ...d, codigo: d.codigo.replace(/\s+/g, "").toUpperCase() });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cup-codigo">Código</Label>
          <Input id="cup-codigo" className="font-mono uppercase" value={d.codigo} onChange={(e) => set({ codigo: e.target.value })} placeholder="UCIM360" />
          <span className="text-xs text-muted-foreground">Sin espacios y en mayúsculas (se reconoce igual si lo escriben distinto).</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cup-tipo">Tipo</Label>
          <select id="cup-tipo" className={selectClase} value={d.tipo} onChange={(e) => set({ tipo: e.target.value as CuponDatos["tipo"] })}>
            {(Object.keys(NOMBRE_TIPO_CUPON) as CuponDatos["tipo"][]).map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TIPO_CUPON[t]}
              </option>
            ))}
          </select>
          {d.tipo === "referido" && <span className="text-xs text-amber-400">Referidos: la estructura está lista; la lógica se arma más adelante.</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cup-camara">Cámara</Label>
          <select id="cup-camara" className={selectClase} value={d.camaraId ?? ""} onChange={(e) => set({ camaraId: e.target.value || null })}>
            <option value="">Ninguna</option>
            {(camaras.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cup-dias">Días de prueba gratis</Label>
          <Input id="cup-dias" type="number" min={1} max={365} placeholder="14 (la común)" value={d.diasPrueba ?? ""} onChange={(e) => set({ diasPrueba: e.target.value ? Number(e.target.value) : null })} />
          <span className="text-xs text-muted-foreground">Reemplazan a los 14 días; de un solo uso por cliente.</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cup-desde">Válido desde</Label>
          <Input id="cup-desde" type="date" value={d.desde ?? ""} onChange={(e) => set({ desde: e.target.value || null })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cup-hasta">Válido hasta</Label>
          <Input id="cup-hasta" type="date" value={d.hasta ?? ""} onChange={(e) => set({ hasta: e.target.value || null })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cup-max">Máximo de usos</Label>
          <Input id="cup-max" type="number" min={1} placeholder="Sin límite" value={d.maxUsos ?? ""} onChange={(e) => set({ maxUsos: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={d.activo} onChange={(e) => set({ activo: e.target.checked })} />
          Activo
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cup-desc">Descripción (para vos)</Label>
        <Input id="cup-desc" value={d.descripcion ?? ""} onChange={(e) => set({ descripcion: e.target.value || null })} placeholder="Ej. Curso de marzo con la UCIM" />
      </div>
      <ReglasEditor reglas={d.reglas} onChange={(reglas) => set({ reglas })} />
      <div className="flex gap-2">
        <Button onClick={guardar} disabled={guardando}>
          Guardar
        </Button>
        <Button variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
