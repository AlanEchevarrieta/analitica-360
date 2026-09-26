"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGuardarConfiguracion, type Configuracion } from "../hooks/use-configuracion";

const aviso = { onSuccess: () => toast.success("Guardado"), onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo guardar") };

function Campo({ id, etiqueta, valor, onCambiar, ...extra }: { id: string; etiqueta: string; valor: string; onCambiar: (v: string) => void } & Partial<React.ComponentProps<typeof Input>>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} value={valor} onChange={(e) => onCambiar(e.target.value)} {...extra} />
    </div>
  );
}

export function RemitenteConfig({ config }: { config: Configuracion }) {
  const guardar = useGuardarConfiguracion();
  const [r, setR] = useState({
    nombre: config.remitente.nombre ?? "",
    direccion: config.remitente.direccion ?? "",
    telefono: config.remitente.telefono ?? "",
    email: config.remitente.email ?? "",
  });
  const set = (k: keyof typeof r) => (v: string) => setR((x) => ({ ...x, [k]: v }));
  return (
    <div className="grid max-w-xl gap-3 sm:grid-cols-2">
      <Campo id="rem-nombre" etiqueta="Nombre" valor={r.nombre} onCambiar={set("nombre")} />
      <Campo id="rem-telefono" etiqueta="Teléfono" valor={r.telefono} onCambiar={set("telefono")} />
      <Campo id="rem-direccion" etiqueta="Dirección" valor={r.direccion} onCambiar={set("direccion")} />
      <Campo id="rem-email" etiqueta="Email" valor={r.email} onCambiar={set("email")} type="email" />
      <Button
        className="self-start"
        disabled={guardar.isPending}
        onClick={() =>
          guardar.mutate(
            { remitente: { nombre: r.nombre.trim() || null, direccion: r.direccion.trim() || null, telefono: r.telefono.trim() || null, email: r.email.trim() || null } },
            aviso,
          )
        }
      >
        Guardar remitente
      </Button>
    </div>
  );
}

export function FiscalConfig({ config }: { config: Configuracion }) {
  const guardar = useGuardarConfiguracion();
  const [f, setF] = useState({
    pais: config.pais,
    moneda: config.moneda,
    simbolo: config.simboloMoneda,
    iva: String(config.alicuotaIva),
    nombreIva: config.nombreIva,
    mostrarIva: config.mostrarIvaVentas,
    condicion: config.condicionFiscal,
    categoria: config.categoriaMonotributo ?? "",
  });
  return (
    <div className="grid max-w-xl gap-3 sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fis-condicion">Condición fiscal</Label>
        <select id="fis-condicion" className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={f.condicion} onChange={(e) => setF({ ...f, condicion: e.target.value })}>
          <option value="monotributo">Monotributo</option>
          <option value="responsable_inscripto">Responsable inscripto</option>
          <option value="exento">Exento</option>
          <option value="otro">Otra</option>
        </select>
      </div>
      {f.condicion === "monotributo" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fis-categoria">Categoría</Label>
          <select id="fis-categoria" className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
            <option value="">Elegí…</option>
            {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="text-xs text-muted-foreground sm:col-span-3">
        Con la categoría, el sistema te avisa si te acercás al tope de facturación o si en la próxima recategorización te corresponde otra.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fis-pais">País</Label>
        <select id="fis-pais" className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={f.pais} onChange={(e) => setF({ ...f, pais: e.target.value })}>
          <option value="argentina">Argentina</option>
          <option value="peru">Perú</option>
          <option value="colombia">Colombia</option>
          <option value="otro">Otro</option>
        </select>
      </div>
      <Campo id="fis-moneda" etiqueta="Moneda" valor={f.moneda} onCambiar={(v) => setF({ ...f, moneda: v.toUpperCase() })} maxLength={3} />
      <Campo id="fis-simbolo" etiqueta="Símbolo" valor={f.simbolo} onCambiar={(v) => setF({ ...f, simbolo: v })} maxLength={4} />
      <Campo id="fis-nombre-iva" etiqueta="Impuesto" valor={f.nombreIva} onCambiar={(v) => setF({ ...f, nombreIva: v })} />
      <Campo id="fis-iva" etiqueta="Alícuota %" valor={f.iva} onCambiar={(v) => setF({ ...f, iva: v })} inputMode="decimal" />
      <label className="flex items-end gap-2 pb-1.5 text-sm">
        <input type="checkbox" checked={f.mostrarIva} onChange={(e) => setF({ ...f, mostrarIva: e.target.checked })} />
        Mostrar IVA en ventas
      </label>
      <Button
        className="self-start"
        disabled={guardar.isPending}
        onClick={() =>
          guardar.mutate(
            {
              pais: f.pais,
              moneda: f.moneda,
              simboloMoneda: f.simbolo,
              alicuotaIva: Number(f.iva.replace(",", ".")) || 0,
              nombreIva: f.nombreIva,
              mostrarIvaVentas: f.mostrarIva,
              condicionFiscal: f.condicion,
              categoriaMonotributo: f.condicion === "monotributo" && f.categoria ? f.categoria : null,
            },
            aviso,
          )
        }
      >
        Guardar
      </Button>
    </div>
  );
}
