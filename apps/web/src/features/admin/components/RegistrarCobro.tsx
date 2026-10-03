"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatoPesos } from "@/lib/formato";
import { hoyAR } from "@/lib/periodos";
import { useEmpresasAdmin } from "../hooks/use-admin";
import { fechaAR, NOMBRE_CICLO, useAccionesAlianzas, useCuotasEmpresa, type Ciclo, type PlanPago, type PropuestaPago } from "../hooks/use-alianzas";
import { Panel } from "./comunes";

const selectClase = "h-8 rounded-lg border bg-transparent px-2 text-sm";
const aMonto = (t: string) => Number(t.replace(/\./g, "").replace(",", "."));
const PLANES: { id: PlanPago; nombre: string }[] = [
  { id: "basico", nombre: "Básico" },
  { id: "pro", nombre: "Pro" },
  { id: "ecommerce", nombre: "E-commerce" },
];

/**
 * Cobro de un cliente: el sistema propone cuánto cobrar (lista, descuento del
 * cupón, primer período o renovación, cuotas) y al registrarlo extiende la
 * suscripción y genera la comisión si vino por una cámara.
 */
export function RegistrarCobro() {
  const empresas = useEmpresasAdmin();
  const { cotizarPago, registrarPago } = useAccionesAlianzas();
  const [f, setF] = useState({ empresaId: "", plan: "basico" as PlanPago, ciclo: "mensual" as Ciclo, enCuotas: false, grupoId: "", metodo: "transferencia", fechaCobro: hoyAR(), notas: "", monto: "" });
  const [propuesta, setPropuesta] = useState<PropuestaPago | null>(null);
  const set = (cambios: Partial<typeof f>) => {
    setF((v) => ({ ...v, ...cambios }));
    setPropuesta(null);
  };

  // Períodos en cuotas con cuotas pendientes de este cliente (del plan de cuotas).
  const cuotasCliente = useCuotasEmpresa(f.empresaId);
  const enCurso = (cuotasCliente.data ?? [])
    .filter((g) => g.pagadas < g.cuotas.length)
    .map((g) => ({ grupoId: g.grupoId, plan: g.plan, ciclo: g.ciclo, pagadas: g.pagadas, cuotas: g.cuotas.length, desde: g.cuotas[0]?.periodoDesde ?? null }));

  function calcular() {
    if (!f.empresaId) return toast.error("Elegí el cliente.");
    cotizarPago.mutate(
      { empresaId: f.empresaId, plan: f.plan, ciclo: f.ciclo, ...(f.grupoId ? { grupoId: f.grupoId } : { enCuotas: f.enCuotas }) },
      {
        onSuccess: (p) => {
          setPropuesta(p);
          setF((v) => ({ ...v, monto: String(p.monto) }));
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  function registrar() {
    if (!propuesta) return;
    const monto = aMonto(f.monto);
    if (!(monto > 0)) return toast.error("Revisá el monto.");
    registrarPago.mutate(
      {
        empresaId: f.empresaId, plan: f.plan, ciclo: f.ciclo, metodo: f.metodo, notas: f.notas, fechaCobro: f.fechaCobro,
        ...(f.grupoId ? { grupoId: f.grupoId } : { enCuotas: f.enCuotas }),
        ...(monto !== propuesta.monto ? { monto } : {}),
      },
      {
        onSuccess: (r) => {
          toast.success(`Cobro registrado${r.comision ? ` · comisión para la cámara: ${formatoPesos(r.comision.monto)}` : ""}`);
          setPropuesta(null);
          setF((v) => ({ ...v, grupoId: "", notas: "", monto: "" }));
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  const c = propuesta?.cotizacion;
  return (
    <Panel titulo="Registrar un cobro" descripcion="El sistema calcula el monto con el descuento del cupón del cliente (si tiene). Lo podés corregir antes de guardar.">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <select className={selectClase} aria-label="Cliente" value={f.empresaId} onChange={(e) => set({ empresaId: e.target.value, grupoId: "" })}>
            <option value="">Cliente…</option>
            {(empresas.data ?? []).filter((e) => !e.baja).map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
          {enCurso.length > 0 && (
            <select className={selectClase} aria-label="Cuota pendiente" value={f.grupoId} onChange={(e) => {
              const g = enCurso.find((x) => x.grupoId === e.target.value);
              set({ grupoId: e.target.value, ...(g ? { plan: g.plan as PlanPago, ciclo: g.ciclo as Ciclo } : {}) });
            }}>
              <option value="">Período nuevo</option>
              {enCurso.map((g) => (
                <option key={g.grupoId} value={g.grupoId}>
                  Cuota {g.pagadas + 1} de {g.cuotas} ({NOMBRE_CICLO[g.ciclo as Ciclo] ?? g.ciclo} desde {fechaAR(g.desde)})
                </option>
              ))}
            </select>
          )}
          {!f.grupoId && (
            <>
              <select className={selectClase} aria-label="Plan" value={f.plan} onChange={(e) => set({ plan: e.target.value as PlanPago })}>
                {PLANES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <select className={selectClase} aria-label="Ciclo" value={f.ciclo} onChange={(e) => set({ ciclo: e.target.value as Ciclo })}>
                {(Object.keys(NOMBRE_CICLO) as Ciclo[]).map((k) => (
                  <option key={k} value={k}>
                    {NOMBRE_CICLO[k]}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={f.enCuotas} onChange={(e) => set({ enCuotas: e.target.checked })} />
                En cuotas sin interés (trimestral y anual)
              </label>
            </>
          )}
          <Button variant="outline" onClick={calcular} disabled={cotizarPago.isPending}>
            Calcular
          </Button>
        </div>

        {propuesta && c && (
          <div className="flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
              <span>{c.tipo === "entrada" ? "Primer período pago" : "Renovación"}{propuesta.cuota ? ` · cuota ${propuesta.cuota} de ${propuesta.cuotas}` : ""}</span>
              <span className="text-muted-foreground">Cubre del {fechaAR(propuesta.periodoDesde)} al {fechaAR(propuesta.periodoHasta)} (excluido)</span>
              <span className="text-muted-foreground">{propuesta.cupon ? `Código ${propuesta.cupon.codigo}${propuesta.cupon.camara ? ` (${propuesta.cupon.camara})` : ""}` : "Sin código: precio de lista"}</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-4">
              {propuesta.precioLista !== propuesta.monto && <span className="text-muted-foreground line-through tabular-nums">{formatoPesos(propuesta.precioLista)}</span>}
              <span className="text-2xl font-semibold tabular-nums">{formatoPesos(propuesta.monto)}</span>
              {c.descuento > 0 && <span className="text-xs text-emerald-400">descuento del período: {formatoPesos(c.descuento)}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Input className="w-36" inputMode="decimal" aria-label="Monto cobrado" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} />
              <select className={selectClase} aria-label="Método" value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value })}>
                <option value="transferencia">Transferencia</option>
                <option value="mercadopago">Mercado Pago</option>
                <option value="efectivo">Efectivo</option>
                <option value="otro">Otro</option>
              </select>
              <Input type="date" className="w-40" aria-label="Fecha de cobro" value={f.fechaCobro} onChange={(e) => setF({ ...f, fechaCobro: e.target.value })} />
              <Input className="min-w-40 flex-1" placeholder="Notas (opcional)" aria-label="Notas" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
              <Button onClick={registrar} disabled={registrarPago.isPending}>
                Registrar cobro
              </Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
