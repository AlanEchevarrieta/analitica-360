import { cn } from "@/lib/utils";

/**
 * Maquetas del sistema para la landing: el mismo diseño de la app con números de
 * ejemplo (nunca datos reales de clientes). Son HTML/SVG: nítidas y livianas.
 */

function Ventana({ children, className, titulo = "analitica360.app" }: { children: React.ReactNode; className?: string; titulo?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-indigo-500/10", className)}>
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-red-300" />
        <span className="size-2.5 rounded-full bg-amber-300" />
        <span className="size-2.5 rounded-full bg-emerald-300" />
        <span className="ml-3 truncate rounded-md bg-white px-3 py-0.5 text-[11px] text-slate-400">{titulo}</span>
      </div>
      {children}
    </div>
  );
}

function Kpi({ etiqueta, valor, detalle, sube = true }: { etiqueta: string; valor: string; detalle: string; sube?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <p className="text-[11px] text-slate-500">{etiqueta}</p>
      <p className="mt-0.5 text-base font-semibold whitespace-nowrap text-slate-900 tabular-nums sm:text-lg">{valor}</p>
      <p className={cn("text-[11px] font-medium", sube ? "text-emerald-600" : "text-slate-400")}>{detalle}</p>
    </div>
  );
}

const BARRAS = [38, 52, 45, 61, 58, 74, 69, 83, 77, 90, 86, 98];

/** Inicio: indicadores, gráfico de ventas y más vendidos. */
export function MaquetaInicio({ className }: { className?: string }) {
  return (
    <Ventana className={className}>
      <div className="grid grid-cols-[auto_1fr]">
        <aside className="hidden w-36 flex-col gap-1 border-r border-slate-100 bg-slate-50/60 p-3 text-[11px] text-slate-500 sm:flex">
          {["Inicio", "Ventas", "Productos", "Clientes", "Compras", "Inventario", "Analytics", "Tienda online"].map((x, i) => (
            <span key={x} className={cn("rounded-md px-2 py-1.5", i === 0 && "bg-indigo-100 font-medium text-indigo-700")}>
              {x}
            </span>
          ))}
        </aside>
        <div className="flex min-w-0 flex-col gap-3 bg-slate-50/40 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Inicio</p>
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">$ · US$</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Kpi etiqueta="Ventas de hoy" valor="$ 384.500" detalle="▲ 12 % vs. ayer" />
            <Kpi etiqueta="Este mes" valor="$ 6.920.300" detalle="▲ 18 % vs. mes pasado" />
            <Kpi etiqueta="Ganancia del mes" valor="$ 2.214.500" detalle="Margen 32 %" />
            <Kpi etiqueta="Ticket promedio" valor="$ 21.300" detalle="325 ventas" sube={false} />
          </div>
          <div className="grid gap-2 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <p className="text-[11px] font-medium text-slate-700">Ventas por mes</p>
              <div className="mt-3 flex h-28 items-end gap-1.5">
                {BARRAS.map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-indigo-500 to-violet-400" style={{ height: `${h}%`, opacity: 0.55 + i * 0.04 }} />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <p className="text-[11px] font-medium text-slate-700">Más vendidos</p>
              <ul className="mt-2 flex flex-col gap-2 text-[11px] text-slate-600">
                {[
                  ["Mate de calabaza", 92],
                  ["Bombilla de alpaca", 74],
                  ["Yerba 1 kg", 61],
                  ["Termo 1 L", 43],
                ].map(([n, v]) => (
                  <li key={n} className="flex flex-col gap-1">
                    <span className="flex justify-between">
                      <span>{n}</span>
                      <span className="tabular-nums text-slate-400">{v}</span>
                    </span>
                    <span className="h-1.5 rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-indigo-400" style={{ width: `${v}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Ventana>
  );
}

/** Tarjeta flotante: una venta registrada en el celular. */
export function MaquetaVentaCelular({ className }: { className?: string }) {
  return (
    <div className={cn("w-56 rounded-[1.6rem] border-4 border-slate-900 bg-white p-3 shadow-2xl", className)}>
      <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-slate-200" />
      <p className="text-xs font-semibold text-slate-900">Nueva venta</p>
      <ul className="mt-2 flex flex-col gap-1.5 text-[11px] text-slate-600">
        <li className="flex justify-between"><span>Mate imperial × 1</span><span className="tabular-nums">$ 38.000</span></li>
        <li className="flex justify-between"><span>Bombilla × 2</span><span className="tabular-nums">$ 14.000</span></li>
        <li className="flex justify-between text-emerald-600"><span>Transferencia −10 %</span><span className="tabular-nums">− $ 5.200</span></li>
      </ul>
      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-xs font-semibold text-slate-900">
        <span>Total</span>
        <span className="tabular-nums">$ 46.800</span>
      </div>
      <div className="mt-2 rounded-lg bg-indigo-600 py-1.5 text-center text-[11px] font-medium text-white">Cobrar</div>
    </div>
  );
}

/** Mini maqueta para cada módulo. */
export function MaquetaModulo({ id }: { id: string }) {
  const caja = "rounded-xl border border-slate-100 bg-white p-3 text-[11px] text-slate-600";
  switch (id) {
    case "stock":
      return (
        <div className={caja}>
          {[
            ["Remera · M · Negro", "24 u.", false],
            ["Remera · L · Blanco", "3 u. · bajo", true],
            ["Buzo · S · Gris", "11 u.", false],
          ].map(([n, s, bajo]) => (
            <div key={n as string} className="flex items-center justify-between gap-2 border-b border-slate-50 py-1.5 last:border-0">
              <span className="truncate">{n}</span>
              <span className={cn("shrink-0 tabular-nums", bajo ? "font-medium text-amber-600" : "text-slate-400")}>{s}</span>
            </div>
          ))}
        </div>
      );
    case "analytics":
      return (
        <div className={caja}>
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700">Ganancia por mes</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">US$</span>
          </div>
          <svg viewBox="0 0 200 60" className="mt-2 h-16 w-full" aria-hidden>
            <path d="M0 50 L25 44 L50 46 L75 34 L100 36 L125 24 L150 26 L175 14 L200 8" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M0 50 L25 44 L50 46 L75 34 L100 36 L125 24 L150 26 L175 14 L200 8 L200 60 L0 60Z" fill="#6366f1" opacity=".08" />
          </svg>
        </div>
      );
    case "contabilidad":
      return (
        <div className={caja}>
          <p className="font-medium text-slate-700">Monotributo · categoría D</p>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div className="h-full w-[68%] rounded-full bg-emerald-500" />
          </div>
          <p className="mt-1.5">Facturaste el 68 % del tope anual. Te quedan $ 9,8 millones.</p>
        </div>
      );
    case "tienda":
      return (
        <div className={caja}>
          <div className="grid grid-cols-3 gap-2">
            {["#e0e7ff", "#fce7f3", "#dcfce7"].map((c, i) => (
              <div key={c} className="flex flex-col gap-1">
                <div className="aspect-square rounded-lg" style={{ background: c }} />
                <span className="h-1.5 w-4/5 rounded bg-slate-200" />
                <span className="text-[10px] font-medium text-slate-700">$ {(i + 2) * 7}.500</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "clientes":
      return (
        <div className={caja}>
          {[
            ["Ferretería Norte", "Debe $ 120.400", "text-red-500"],
            ["María López", "Al día", "text-emerald-600"],
            ["Kiosco Plaza", "Debe $ 35.000", "text-red-500"],
          ].map(([n, s, c]) => (
            <div key={n} className="flex items-center justify-between border-b border-slate-50 py-1.5 last:border-0">
              <span>{n}</span>
              <span className={cn("font-medium", c)}>{s}</span>
            </div>
          ))}
        </div>
      );
    case "compras":
      return (
        <div className={caja}>
          <div className="flex justify-between gap-2"><span>Compra · Dist. Sur</span><span className="tabular-nums">$ 812.000</span></div>
          <div className="mt-1.5 flex justify-between gap-2 text-slate-400"><span>Flete repartido</span><span className="tabular-nums">$ 24.000</span></div>
          <div className="mt-1.5 flex justify-between gap-2 font-medium text-indigo-600"><span>Costo promedio</span><span className="tabular-nums">$ 6.480</span></div>
        </div>
      );
    case "informes":
      return (
        <div className={caja}>
          <p className="font-medium text-slate-700">📩 Tu semana en Analítica 360</p>
          <p className="mt-1">Vendiste $ 1.640.000 (▲ 9 %). Lo más vendido: Mate de calabaza.</p>
          <p className="mt-1 text-indigo-600">Ver el informe en PDF →</p>
        </div>
      );
    default:
      return (
        <div className={caja}>
          {[
            ["V-000325", "Efectivo", "$ 21.300"],
            ["V-000324", "Tarjeta · 3 cuotas", "$ 64.900"],
            ["V-000323", "Transferencia", "$ 15.200"],
          ].map(([n, f, t]) => (
            <div key={n} className="flex items-center justify-between gap-2 border-b border-slate-50 py-1.5 last:border-0">
              <span className="flex flex-col">
                <span className="font-medium text-slate-700">{n}</span>
                <span className="text-[10px] text-slate-400">{f}</span>
              </span>
              <span className="font-medium tabular-nums text-slate-700">{t}</span>
            </div>
          ))}
        </div>
      );
  }
}
