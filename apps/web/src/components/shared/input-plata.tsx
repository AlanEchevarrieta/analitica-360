"use client";

import { useLayoutEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatearPlata, limpiarPlata } from "@/lib/plata";

const significativos = (s: string) => s.replace(/[^\d,]/g, "").length;

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "type" | "inputMode"> & {
  /** Número "limpio" en texto ("1500.5"); "" = vacío. */
  value: string;
  moneda?: "ARS" | "USD";
  /** false = campo común (por ejemplo cuando el mismo campo es un porcentaje). */
  formato?: boolean;
};

/**
 * Campo de plata como en los bancos: mientras se escribe aparecen el signo, los puntos de
 * miles y la coma decimal ($ 1.234.567,89). Hacia afuera entrega el número limpio
 * ("1234567.89") en `e.target.value`, igual que un input común.
 */
export function InputPlata({ value, onChange, moneda = "ARS", formato = true, className, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);
  const mostrado = formatearPlata(value);

  // Después de reformatear, el cursor queda donde estaba (contando solo dígitos y coma).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || cursor.current == null || document.activeElement !== el) return;
    let pos = 0;
    let vistos = 0;
    while (pos < mostrado.length && vistos < cursor.current) {
      if (/[\d,]/.test(mostrado[pos])) vistos++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
    cursor.current = null;
  });

  if (!formato) return <Input inputMode="decimal" value={value} onChange={onChange} className={className} {...props} />;

  const prefijo = moneda === "USD" ? "US$" : "$";
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>
        {prefijo}
      </span>
      <Input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        value={mostrado}
        className={cn(moneda === "USD" ? "pl-10" : "pl-6", "tabular-nums", className)}
        onChange={(e) => {
          const crudo = e.target.value;
          const antes = crudo.slice(0, e.target.selectionStart ?? crudo.length);
          // Un punto tecleado al final pasa a ser la coma decimal: cuenta como tal para el cursor.
          cursor.current = significativos(antes.endsWith(".") && !crudo.includes(",") && antes.length === crudo.length ? `${antes.slice(0, -1)},` : antes);
          e.target.value = limpiarPlata(crudo);
          onChange?.(e);
        }}
        {...props}
      />
    </div>
  );
}
