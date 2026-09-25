"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGuardarConfiguracion, type Configuracion, type TasaCuota } from "../hooks/use-configuracion";

const MEDIOS = [
  { id: "efectivo", etiqueta: "Efectivo" },
  { id: "transferencia", etiqueta: "Transferencia" },
  { id: "debito", etiqueta: "Débito" },
  { id: "credito", etiqueta: "Crédito" },
  { id: "mp_qr", etiqueta: "Mercado Pago QR" },
];

const aviso = { onSuccess: () => toast.success("Guardado"), onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo guardar") };

export function MediosConfig({ config }: { config: Configuracion }) {
  const guardar = useGuardarConfiguracion();
  const [medios, setMedios] = useState(config.mediosPago);
  const alternar = (id: string) => setMedios((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {MEDIOS.map((m) => (
          <label key={m.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <input type="checkbox" checked={medios.includes(m.id)} onChange={() => alternar(m.id)} />
            {m.etiqueta}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Solo los medios marcados aparecen al cobrar una venta o despachar un pedido.</p>
      <Button className="self-start" disabled={guardar.isPending || medios.length === 0} onClick={() => guardar.mutate({ mediosPago: medios }, aviso)}>
        Guardar medios de pago
      </Button>
    </div>
  );
}

export function CuotasConfig({ config }: { config: Configuracion }) {
  const guardar = useGuardarConfiguracion();
  const [tasas, setTasas] = useState<(TasaCuota & { clave: string })[]>(() => config.tasasCuotas.map((t) => ({ ...t, clave: crypto.randomUUID() })));
  const cambiar = (clave: string, c: Partial<TasaCuota>) => setTasas((ts) => ts.map((t) => (t.clave === clave ? { ...t, ...c } : t)));

  function onGuardar() {
    const repetidas = tasas.map((t) => t.cuotas).filter((c, i, a) => a.indexOf(c) !== i);
    if (repetidas.length) return toast.error(`Hay dos planes de ${repetidas[0]} cuotas.`);
    guardar.mutate({ tasasCuotas: tasas.map(({ clave: _c, ...t }) => (void _c, { ...t, label: t.label || `${t.cuotas} cuotas` })) }, aviso);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[80px_100px_1fr_70px_32px] items-center gap-2 text-xs text-muted-foreground">
        <span>Cuotas</span>
        <span>Interés %</span>
        <span>Nombre</span>
        <span>Activa</span>
        <span />
      </div>
      {tasas.map((t) => (
        <div key={t.clave} className="grid grid-cols-[80px_100px_1fr_70px_32px] items-center gap-2">
          <Input inputMode="numeric" aria-label="Cantidad de cuotas" value={t.cuotas} onChange={(e) => cambiar(t.clave, { cuotas: Math.max(0, Number.parseInt(e.target.value, 10) || 0) })} />
          <Input inputMode="decimal" aria-label="Interés" value={t.tasa} onChange={(e) => cambiar(t.clave, { tasa: Math.max(0, Number(e.target.value.replace(",", ".")) || 0) })} />
          <Input aria-label="Nombre del plan" value={t.label} onChange={(e) => cambiar(t.clave, { label: e.target.value })} />
          <input type="checkbox" aria-label="Plan activo" checked={t.activo} onChange={(e) => cambiar(t.clave, { activo: e.target.checked })} />
          <Button size="icon-sm" variant="ghost" aria-label="Quitar plan" onClick={() => setTasas((ts) => ts.filter((x) => x.clave !== t.clave))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setTasas((ts) => [...ts, { cuotas: 0, tasa: 0, label: "", activo: true, personalizada: true, clave: crypto.randomUUID() }])}>
          <Plus aria-hidden /> Agregar plan
        </Button>
        <Button disabled={guardar.isPending} onClick={onGuardar}>
          Guardar cuotas
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Al vender con crédito aparecen como botones con el interés ya cargado (1 y 3 sin interés, 6 con 15%, etc.).</p>
    </div>
  );
}
