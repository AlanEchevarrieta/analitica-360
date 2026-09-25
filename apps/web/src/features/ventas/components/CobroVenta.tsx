"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatoPesos } from "@/lib/formato";
import type { ClienteVenta, ConfiguracionVenta, UbicacionVenta } from "../hooks/use-nueva-venta";
import { FORMAS_PAGO } from "../types/nueva-venta";

export interface DatosCobro {
  formaPago: string;
  descuento: string;
  cuotas: string;
  interes: string;
  esSenia: boolean;
  montoSenia: string;
  cliente: string;
  /** Solo para un cliente nuevo: se guarda en su ficha (CRM, difusiones, cumpleaños). */
  telefono: string;
  ubicacion: string;
  /** Efectivo: con cuánto paga, para calcular el vuelto (no se guarda). */
  pagaCon: string;
}

export const COBRO_INICIAL: DatosCobro = {
  formaPago: "efectivo",
  descuento: "",
  cuotas: "1",
  interes: "0",
  esSenia: false,
  montoSenia: "",
  cliente: "",
  telefono: "",
  ubicacion: "",
  pagaCon: "",
};

/** El cliente escrito no existe todavía: se va a crear al registrar la venta. */
export function esClienteNuevo(nombre: string, clientes: ClienteVenta[]) {
  const n = nombre.trim().toLowerCase();
  return n.length > 0 && !clientes.some((c) => c.nombre.toLowerCase() === n);
}

export { aNumero } from "@/lib/numeros";
import { aNumero } from "@/lib/numeros";

export function calcularTotales(subtotal: number, cobro: DatosCobro) {
  const descuento = Math.min(aNumero(cobro.descuento), subtotal);
  const sinInteres = subtotal - descuento;
  const credito = cobro.formaPago === "credito";
  const interes = credito ? Math.round(sinInteres * aNumero(cobro.interes)) / 100 : 0;
  const total = sinInteres + interes;
  const cuotas = credito ? Math.max(1, Math.round(aNumero(cobro.cuotas)) || 1) : 1;
  return { descuento, sinInteres, interes, total, cuotas, valorCuota: total / cuotas };
}

export function CobroVenta({
  cobro,
  onCambiar,
  subtotal,
  clientes,
  ubicaciones,
  config,
}: {
  cobro: DatosCobro;
  onCambiar: (cambios: Partial<DatosCobro>) => void;
  subtotal: number;
  clientes: ClienteVenta[];
  ubicaciones: UbicacionVenta[];
  /** Medios y cuotas de la empresa; sin configuración se muestran todos los medios y cuotas a mano. */
  config: ConfiguracionVenta | undefined;
}) {
  const t = calcularTotales(subtotal, cobro);
  const medios = config ? FORMAS_PAGO.filter((f) => config.mediosPago.includes(f.valor)) : FORMAS_PAGO;
  const planes = config?.cuotas ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Medio de pago</Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Medio de pago">
          {medios.map((f) => (
            <Button
              key={f.valor}
              size="sm"
              variant={cobro.formaPago === f.valor ? "default" : "outline"}
              aria-pressed={cobro.formaPago === f.valor}
              onClick={() => onCambiar({ formaPago: f.valor })}
            >
              {f.etiqueta}
            </Button>
          ))}
        </div>
      </div>

      {cobro.formaPago === "efectivo" && (
        <div className="grid grid-cols-2 items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cobro-paga-con">Paga con $</Label>
            <Input
              id="cobro-paga-con"
              inputMode="decimal"
              placeholder="Opcional"
              value={cobro.pagaCon}
              onChange={(e) => onCambiar({ pagaCon: e.target.value })}
            />
          </div>
          {aNumero(cobro.pagaCon) > t.total && (
            <p className="pb-1.5 text-sm">
              Vuelto: <span className="font-semibold tabular-nums">{formatoPesos(aNumero(cobro.pagaCon) - t.total)}</span>
            </p>
          )}
        </div>
      )}

      {cobro.formaPago === "credito" && planes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>Cuotas</Label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Cuotas">
            {planes.map((p) => {
              const elegido = aNumero(cobro.cuotas) === p.cuotas && aNumero(cobro.interes) === p.tasa;
              return (
                <Button
                  key={p.cuotas}
                  size="sm"
                  variant={elegido ? "default" : "outline"}
                  aria-pressed={elegido}
                  onClick={() => onCambiar({ cuotas: String(p.cuotas), interes: String(p.tasa) })}
                >
                  {p.cuotas} {p.tasa > 0 ? `(+${p.tasa}%)` : "sin interés"}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {cobro.formaPago === "credito" && planes.length === 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cobro-cuotas">Cuotas</Label>
            <Input id="cobro-cuotas" inputMode="numeric" value={cobro.cuotas} onChange={(e) => onCambiar({ cuotas: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cobro-interes">Interés %</Label>
            <Input id="cobro-interes" inputMode="decimal" value={cobro.interes} onChange={(e) => onCambiar({ interes: e.target.value })} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cobro-descuento">Descuento $</Label>
          <Input
            id="cobro-descuento"
            inputMode="decimal"
            placeholder="0"
            value={cobro.descuento}
            onChange={(e) => onCambiar({ descuento: e.target.value })}
          />
        </div>
        {ubicaciones.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cobro-ubicacion">Sale de</Label>
            <select
              id="cobro-ubicacion"
              className="h-8 rounded-lg border bg-transparent px-2 text-sm"
              value={cobro.ubicacion || ubicaciones[0].nombre}
              onChange={(e) => onCambiar({ ubicacion: e.target.value })}
            >
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.nombre}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {config?.mostrarCliente !== "no_mostrar" && (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cobro-cliente">{config?.mostrarCliente === "siempre" ? "Cliente" : "Cliente (opcional)"}</Label>
        <Input
          id="cobro-cliente"
          list="clientes-venta"
          placeholder="Nombre del cliente"
          value={cobro.cliente}
          onChange={(e) => onCambiar({ cliente: e.target.value })}
        />
        <datalist id="clientes-venta">
          {clientes.map((c) => (
            <option key={c.id} value={c.nombre} />
          ))}
        </datalist>
        {esClienteNuevo(cobro.cliente, clientes) && config?.crearClienteDesdeVenta !== false && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">Cliente nuevo: se guarda en Clientes al registrar la venta.</p>
            <Input
              aria-label="Teléfono del cliente (opcional)"
              inputMode="tel"
              placeholder="Teléfono (opcional)"
              value={cobro.telefono}
              onChange={(e) => onCambiar({ telefono: e.target.value })}
            />
          </div>
        )}
      </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cobro.esSenia} onChange={(e) => onCambiar({ esSenia: e.target.checked })} />
        Es una seña (paga una parte ahora)
      </label>
      {cobro.esSenia && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cobro-senia">Monto de la seña $</Label>
          <Input id="cobro-senia" inputMode="decimal" value={cobro.montoSenia} onChange={(e) => onCambiar({ montoSenia: e.target.value })} />
        </div>
      )}

      <dl className="flex flex-col gap-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums">{formatoPesos(subtotal)}</dd>
        </div>
        {t.descuento > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Descuento</dt>
            <dd className="tabular-nums">−{formatoPesos(t.descuento)}</dd>
          </div>
        )}
        {t.interes > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Interés</dt>
            <dd className="tabular-nums">{formatoPesos(t.interes)}</dd>
          </div>
        )}
        <div className="flex justify-between text-lg font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatoPesos(t.total)}</dd>
        </div>
        {t.cuotas > 1 && (
          <p className="text-right text-muted-foreground">
            {t.cuotas} cuotas de {formatoPesos(t.valorCuota)}
          </p>
        )}
        {cobro.esSenia && aNumero(cobro.montoSenia) > 0 && (
          <p className="text-right text-amber-500">
            Queda debiendo {formatoPesos(Math.max(0, t.total - aNumero(cobro.montoSenia)))}
          </p>
        )}
      </dl>
    </div>
  );
}
