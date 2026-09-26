"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const sinSuscripcion = () => () => {};

/**
 * Dibuja `children` recién en el navegador (en el servidor, `reserva`).
 * Para widgets de Clerk: si clerk-js ya estaba cargado (ej. justo después del
 * login), en el primer render del cliente dibujan algo que el servidor no
 * dibujó y la hidratación falla.
 */
export function SoloCliente({ children, reserva = null }: { children: ReactNode; reserva?: ReactNode }) {
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  return montado ? children : reserva;
}
