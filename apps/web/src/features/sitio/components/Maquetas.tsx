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

/** Fondo suave con la maqueta de cada bloque destacado. */
function Lienzo({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-100 via-indigo-50 to-white p-6 ring-1 ring-indigo-100 sm:p-10">
      <div className="pointer-events-none absolute -top-6 -right-6 size-32 rounded-full bg-violet-300/30 blur-2xl" aria-hidden />
      {children}
    </div>
  );
}

const tarjeta = "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-lg shadow-indigo-900/5";

/** Maqueta grande de cada bloque destacado (operacion, numeros, online). */
export function MaquetaDestacada({ id }: { id: string }) {
  if (id === "numeros")
    return (
      <Lienzo>
        <div className={tarjeta}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500">Ganancia del mes</p>
              <p className="text-2xl font-semibold text-slate-900 tabular-nums">$ 2.214.500</p>
              <p className="text-xs font-medium text-emerald-600">▲ 18 % · margen 32 %</p>
            </div>
            <span className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500">$ · US$</span>
          </div>
          <svg viewBox="0 0 300 90" className="mt-4 h-24 w-full" aria-hidden>
            <defs>
              <linearGradient id="area-numeros" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#6366f1" stopOpacity=".25" />
                <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 72 C30 66 50 70 75 58 S120 50 150 44 S200 36 225 26 S270 18 300 10 L300 90 L0 90Z" fill="url(#area-numeros)" />
            <path d="M0 72 C30 66 50 70 75 58 S120 50 150 44 S200 36 225 26 S270 18 300 10" fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <div className={cn(tarjeta, "relative mt-4 ml-auto w-[85%] sm:-mt-6 sm:w-[70%]")}>
          <p className="text-xs font-medium text-slate-700">Monotributo · categoría D</p>
          <div className="mt-2.5 h-2 rounded-full bg-slate-100">
            <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
          </div>
          <p className="mt-2 text-xs text-slate-500">68 % del tope anual · te quedan $ 9,8 millones</p>
        </div>
      </Lienzo>
    );
  if (id === "online")
    return (
      <Lienzo>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-indigo-900/5">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold tracking-tight text-slate-900">tu-tienda.com.ar</span>
            <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-medium text-white">Carrito · 2</span>
          </div>
          <div className="grid grid-cols-3 gap-3 p-4">
            {[
              ["from-indigo-100 to-violet-200", "$ 21.500", "−15 %"],
              ["from-rose-100 to-orange-100", "$ 14.800", ""],
              ["from-emerald-100 to-teal-100", "$ 32.900", ""],
            ].map(([g, p, o]) => (
              <div key={g} className="flex flex-col gap-1.5">
                <div className={cn("relative aspect-[4/5] rounded-xl bg-gradient-to-br", g)}>
                  {o && <span className="absolute top-1.5 left-1.5 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">{o}</span>}
                </div>
                <span className="h-1.5 w-4/5 rounded bg-slate-200" />
                <span className="text-xs font-semibold text-slate-800 tabular-nums">{p}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={cn(tarjeta, "relative mt-4 flex items-center gap-3 sm:-mt-5 sm:mr-8 sm:ml-auto sm:w-fit")}>
          <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-sm">🛍️</span>
          <div>
            <p className="text-xs font-semibold text-slate-900">Pedido nuevo · $ 36.300</p>
            <p className="text-[11px] text-slate-500">Ya descontado del stock</p>
          </div>
        </div>
      </Lienzo>
    );
  return (
    <Lienzo>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end">
        <MaquetaVentaCelular className="shrink-0" />
        <div className={cn(tarjeta, "w-full sm:mb-6")}>
          <p className="text-xs font-medium text-slate-700">Stock</p>
          {[
            ["Remera · M · Negro", "24 u.", false],
            ["Remera · L · Blanco", "3 u.", true],
            ["Buzo · S · Gris", "11 u.", false],
          ].map(([n, c, bajo]) => (
            <div key={n as string} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 text-xs last:border-0">
              <span className="text-slate-600">{n}</span>
              <span className={cn("whitespace-nowrap tabular-nums", bajo ? "rounded-md bg-amber-50 px-1.5 font-medium text-amber-700" : "text-slate-400")}>{bajo ? `${c} · bajo` : c}</span>
            </div>
          ))}
        </div>
      </div>
    </Lienzo>
  );
}
