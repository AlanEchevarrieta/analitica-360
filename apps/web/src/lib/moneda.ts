"use client";

import { useSyncExternalStore } from "react";

/** En qué moneda se ven el Inicio y Analytics. Se carga todo en pesos; los dólares son solo para ver. */
export type Moneda = "ARS" | "USD";

const CLAVE = "a360-moneda";
let actual: Moneda | null = null;
const avisar = new Set<() => void>();

function leer(): Moneda {
  if (actual) return actual;
  try {
    actual = localStorage.getItem(CLAVE) === "USD" ? "USD" : "ARS";
  } catch {
    actual = "ARS";
  }
  return actual;
}

export function cambiarMoneda(m: Moneda) {
  actual = m;
  try {
    localStorage.setItem(CLAVE, m);
  } catch {
    // Sin almacenamiento (modo privado): vale para esta pestaña.
  }
  for (const f of avisar) f();
}

const suscribir = (f: () => void) => {
  avisar.add(f);
  return () => avisar.delete(f);
};

/** La moneda elegida (en el servidor y al cargar, pesos). */
export function useMoneda(): Moneda {
  return useSyncExternalStore(suscribir, leer, () => "ARS");
}

/** Moneda con la que se formatea ahora (fuera de React, ej. formateadores de gráficos). */
export const monedaActual = (): Moneda => (typeof window === "undefined" ? "ARS" : leer());

/** "&moneda=USD" para agregar a una URL que ya tiene parámetros (vacío en pesos). */
export const paramMoneda = (m: Moneda) => (m === "USD" ? "&moneda=USD" : "");
