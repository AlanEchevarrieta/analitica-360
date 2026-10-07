"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus, Sparkles } from "lucide-react";
import { PLANES as CATALOGO } from "@analitica360/shared-types";
import { cn } from "@/lib/utils";
import { CICLOS, PLANES, PLANES_PAGOS, PRECIO_MENSUAL, type Ciclo, type PlanPagoId } from "@/features/planes/planes";
import { ahorroAnual, COMPARACION, CUOTAS_ANUAL, DESCUENTO_CICLO, DIAS_PRUEBA, linkWhatsApp, MESES, precioPeriodo, precioPorMes, type FilaComparacion } from "../contenido";

const pesos = (n: number) => `$ ${n.toLocaleString("es-AR")}`;

const PARA_QUIEN: Record<PlanPagoId, string> = {
  basico: "Para ordenar ventas, stock y compras.",
  pro: "Para conocer tu negocio a fondo y trabajar en equipo.",
  ecommerce: "Para vender también por internet con tu tienda.",
};

const DESTACADOS: Record<PlanPagoId, string[]> = {
  basico: ["Ventas, productos y clientes", "Compras, proveedores e inventario", "Informe semanal por email", "2 usuarios y 2 locales"],
  pro: ["Todo lo del Básico", "Analytics, Insights y vista en dólares", "Contabilidad y monotributo", "Cuenta corriente y listas de precios", "Producción, pedidos e importar de Excel"],
  ecommerce: ["Todo lo del Pro", "Tienda online con tu dominio", "Ofertas, cupones y cuentas de compradores", "Usuarios y locales ilimitados"],
};

const MENSAJE_CICLO: Record<Ciclo, string> = {
  mensual: "Pagás mes a mes, sin permanencia.",
  trimestral: "Ahorrás 15 % pagando cada 3 meses.",
  anual: `Pagás 9 meses y usás 12, en hasta ${CUOTAS_ANUAL} cuotas sin interés.`,
};

function celda(fila: FilaComparacion, id: PlanPagoId) {
  if (fila.limite) {
    const n = CATALOGO[id][fila.limite];
    return <span className="text-sm font-medium text-slate-700">{n == null ? "Ilimitados" : n}</span>;
  }
  return PLANES[id].modulos.includes(fila.funcion ?? "") ? (
    <Check className="mx-auto size-5 text-indigo-600" aria-label="Incluido" />
  ) : (
    <Minus className="mx-auto size-4 text-slate-300" aria-label="No incluido" />
  );
}

export function Planes() {
  const [ciclo, setCiclo] = useState<Ciclo>("anual");
  return (
    <div className="flex flex-col gap-12">
      {/* Ciclo de pago */}
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm" role="radiogroup" aria-label="Forma de pago">
          {CICLOS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={ciclo === c.id}
              onClick={() => setCiclo(c.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all sm:px-5",
                ciclo === c.id ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {c.nombre}
              {DESCUENTO_CICLO[c.id] > 0 && (
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", ciclo === c.id ? "bg-emerald-400 text-slate-900" : "bg-emerald-50 text-emerald-700")}>
                  −{DESCUENTO_CICLO[c.id] * 100}%
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="text-sm font-medium text-emerald-700">{MENSAJE_CICLO[ciclo]}</p>
      </div>

      {/* Tarjetas */}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
        {PLANES_PAGOS.map((id) => {
          const destacado = PLANES[id].popular;
          const conDescuento = DESCUENTO_CICLO[ciclo] > 0;
          return (
            <div
              key={id}
              className={cn(
                "relative flex flex-col rounded-3xl p-7",
                destacado ? "bg-slate-900 text-white shadow-2xl shadow-indigo-900/30 lg:-my-3 lg:py-10" : "border border-slate-200 bg-white text-slate-900 shadow-sm",
              )}
            >
              {destacado && (
                <span className="absolute -top-3.5 left-7 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1 text-xs font-semibold text-white shadow">
                  <Sparkles className="size-3.5" /> El más elegido
                </span>
              )}
              <h3 className="text-xl font-semibold">{PLANES[id].nombre}</h3>
              <p className={cn("mt-1 text-sm", destacado ? "text-slate-300" : "text-slate-500")}>{PARA_QUIEN[id]}</p>

              <div className="mt-6 min-h-[7.5rem]">
                {conDescuento && (
                  <p className={cn("text-sm line-through", destacado ? "text-slate-400" : "text-slate-400")}>{pesos(PRECIO_MENSUAL[id])} / mes</p>
                )}
                <p className="flex items-baseline gap-1.5">
                  <span className="text-[2.6rem] leading-none font-bold tracking-tight tabular-nums">{pesos(precioPorMes(id, ciclo))}</span>
                  <span className={cn("text-sm", destacado ? "text-slate-300" : "text-slate-500")}>/ mes + IVA</span>
                </p>
                {conDescuento ? (
                  <p className="mt-3 inline-flex rounded-lg bg-emerald-400/15 px-2.5 py-1 text-sm font-semibold text-emerald-600">
                    <span className={destacado ? "text-emerald-300" : ""}>Ahorrás {pesos(ahorroAnual(id, ciclo))} por año</span>
                  </p>
                ) : (
                  <p className={cn("mt-3 text-sm", destacado ? "text-slate-300" : "text-slate-500")}>Sin permanencia</p>
                )}
                {ciclo !== "mensual" && (
                  <p className={cn("mt-2 text-xs", destacado ? "text-slate-400" : "text-slate-500")}>
                    {pesos(precioPeriodo(id, ciclo))} cada {MESES[ciclo]} meses
                    {ciclo === "anual" ? ` · hasta ${CUOTAS_ANUAL} cuotas sin interés` : ""}
                  </p>
                )}
              </div>

              <Link
                prefetch={false}
                href="/sign-up"
                className={cn(
                  "mt-6 rounded-xl py-3 text-center text-sm font-semibold transition-colors",
                  destacado ? "bg-white text-slate-900 hover:bg-indigo-50" : "bg-indigo-600 text-white hover:bg-indigo-700",
                )}
              >
                Probar {DIAS_PRUEBA} días gratis
              </Link>
              <ul className={cn("mt-7 flex flex-col gap-3 border-t pt-6 text-sm", destacado ? "border-white/10 text-slate-200" : "border-slate-100 text-slate-600")}>
                {DESTACADOS[id].map((d) => (
                  <li key={d} className="flex gap-2.5">
                    <Check className={cn("mt-0.5 size-4 shrink-0", destacado ? "text-indigo-300" : "text-indigo-600")} />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Comparación, siempre a la vista */}
      <div className="mt-6">
        <h3 className="text-center text-2xl font-bold tracking-tight text-slate-900">Compará los planes en detalle</h3>
        <p className="mt-2 text-center text-slate-500">Todo lo que trae cada uno, para que elijas sin dudas.</p>
        <p className="mt-6 text-center text-xs text-slate-400 sm:hidden">Deslizá la tabla para ver los tres planes →</p>
        <div className="mt-3 overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm sm:mt-8">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <thead>
              <tr>
                <th className="w-[40%] px-6 py-5 align-bottom text-sm font-medium text-slate-500">Incluye</th>
                {PLANES_PAGOS.map((id) => (
                  <th key={id} className={cn("px-4 py-5 text-center align-bottom", PLANES[id].popular && "bg-indigo-50/70")}>
                    <span className="block text-base font-semibold text-slate-900">{PLANES[id].nombre}</span>
                    <span className="mt-0.5 block text-sm font-normal text-slate-500 tabular-nums">{pesos(precioPorMes(id, ciclo))} / mes</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARACION.map((g) => (
                <GrupoComparacion key={g.grupo} grupo={g.grupo} filas={g.filas} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Precios en pesos argentinos, más IVA. ¿Dudas sobre qué plan te conviene?{" "}
          <a href={linkWhatsApp("Hola, quiero que me ayuden a elegir un plan de Analítica 360")} className="font-semibold text-indigo-700 hover:underline" target="_blank" rel="noopener noreferrer">
            Escribinos por WhatsApp
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function GrupoComparacion({ grupo, filas }: { grupo: string; filas: FilaComparacion[] }) {
  return (
    <>
      <tr>
        <th colSpan={4} scope="colgroup" className="border-t border-slate-200 bg-slate-50 px-6 py-2.5 text-xs font-semibold tracking-wider text-slate-500 uppercase">
          {grupo}
        </th>
      </tr>
      {filas.map((f) => (
        <tr key={f.etiqueta} className="border-t border-slate-100">
          <td className="px-6 py-3.5 text-sm text-slate-700">{f.etiqueta}</td>
          {PLANES_PAGOS.map((id) => (
            <td key={id} className={cn("px-4 py-3.5 text-center", PLANES[id].popular && "bg-indigo-50/40")}>
              {celda(f, id)}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
