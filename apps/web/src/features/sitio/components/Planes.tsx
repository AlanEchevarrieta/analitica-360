"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CICLOS, MODULOS as MODULOS_PLAN, PLANES, PLANES_PAGOS, type Ciclo, type PlanPagoId } from "@/features/planes/planes";
import { CUOTAS_ANUAL, DESCUENTO_CICLO, DIAS_PRUEBA, linkWhatsApp, MESES, precioPeriodo, precioPorMes } from "../contenido";

const pesos = (n: number) => `$ ${n.toLocaleString("es-AR")}`;

const PARA_QUIEN: Record<PlanPagoId, string> = {
  basico: "Para empezar a ordenar ventas, stock y compras.",
  pro: "Para conocer tu negocio a fondo y trabajar en equipo.",
  ecommerce: "Para vender también por internet con tu propia tienda.",
};

const DESTACADOS: Record<PlanPagoId, string[]> = {
  basico: ["Ventas, productos y clientes", "Compras, proveedores e inventario", "Informe semanal por email", "Soporte por WhatsApp"],
  pro: ["Todo lo del Básico", "Analytics, Insights y vista en dólares", "Contabilidad y control del monotributo", "Cuenta corriente y listas de precios", "Producción, pedidos e importar de Excel"],
  ecommerce: ["Todo lo del Pro", "Tienda online con tu dominio", "Ofertas, cupones y descuento por transferencia", "Usuarios y ubicaciones ilimitados"],
};

export function Planes() {
  const [ciclo, setCiclo] = useState<Ciclo>("anual");
  return (
    <div className="flex flex-col gap-10">
      <div className="mx-auto inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="radiogroup" aria-label="Forma de pago">
        {CICLOS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={ciclo === c.id}
            onClick={() => setCiclo(c.id)}
            className={cn("rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4", ciclo === c.id ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:text-slate-900")}
          >
            {c.nombre}
            {DESCUENTO_CICLO[c.id] > 0 && <span className={cn("ml-1.5 text-xs", ciclo === c.id ? "text-indigo-100" : "text-emerald-600")}>−{DESCUENTO_CICLO[c.id] * 100}%</span>}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {PLANES_PAGOS.map((id) => {
          const destacado = PLANES[id].popular;
          return (
            <div
              key={id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm",
                destacado ? "border-indigo-500 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500" : "border-slate-200",
              )}
            >
              {destacado && <span className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">El más elegido</span>}
              <h3 className="text-lg font-semibold text-slate-900">{PLANES[id].nombre}</h3>
              <p className="mt-1 text-sm text-slate-500">{PARA_QUIEN[id]}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-slate-900 tabular-nums">{pesos(precioPorMes(id, ciclo))}</span>
                <span className="text-sm text-slate-500">/ mes + IVA</span>
              </p>
              <p className="mt-1 min-h-10 text-xs text-slate-500">
                {ciclo === "mensual"
                  ? "Pagás mes a mes, sin permanencia."
                  : `${pesos(precioPeriodo(id, ciclo))} cada ${MESES[ciclo]} meses${ciclo === "anual" ? `, en hasta ${CUOTAS_ANUAL} cuotas sin interés` : ""}.`}
              </p>
              <Link
                prefetch={false}
                href="/sign-up"
                className={cn(
                  "mt-5 rounded-lg py-2.5 text-center text-sm font-medium",
                  destacado ? "bg-indigo-600 text-white hover:bg-indigo-700" : "border border-slate-200 text-slate-800 hover:bg-slate-50",
                )}
              >
                Probar {DIAS_PRUEBA} días gratis
              </Link>
              <ul className="mt-6 flex flex-col gap-2.5 text-sm text-slate-600">
                {DESTACADOS[id].map((d) => (
                  <li key={d} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-indigo-600" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <details className="group rounded-2xl border border-slate-200 bg-white">
        <summary className="cursor-pointer list-none px-6 py-4 text-center text-sm font-medium text-indigo-700 hover:bg-slate-50">
          Comparar todo lo que trae cada plan <span className="inline-block transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-6 py-3 font-medium">Incluye</th>
                {PLANES_PAGOS.map((id) => (
                  <th key={id} className="px-3 py-3 text-center font-medium text-slate-900">
                    {PLANES[id].nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Usuarios", PLANES_PAGOS.map((id) => PLANES[id].usuarios)],
                ["Ubicaciones (local, depósito, ferias)", PLANES_PAGOS.map((id) => PLANES[id].productos)],
              ].map(([n, vals]) => (
                <tr key={n as string} className="border-t border-slate-100">
                  <td className="px-6 py-2.5 text-slate-700">{n}</td>
                  {(vals as string[]).map((v, i) => (
                    <td key={i} className="px-3 py-2.5 text-center text-slate-600">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
              {MODULOS_PLAN.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-6 py-2.5 text-slate-700">{m.etiqueta}</td>
                  {PLANES_PAGOS.map((id) => (
                    <td key={id} className="px-3 py-2.5 text-center">
                      {PLANES[id].modulos.includes(m.id) ? (
                        <Check className="mx-auto size-4 text-indigo-600" aria-label="Incluido" />
                      ) : (
                        <Minus className="mx-auto size-4 text-slate-300" aria-label="No incluido" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="text-center text-sm text-slate-500">
        ¿Tenés dudas sobre qué plan te conviene?{" "}
        <a href={linkWhatsApp("Hola, quiero que me ayuden a elegir un plan de Analítica 360")} className="font-medium text-indigo-700 hover:underline" target="_blank" rel="noopener noreferrer">
          Escribinos por WhatsApp
        </a>
        .
      </p>
    </div>
  );
}
