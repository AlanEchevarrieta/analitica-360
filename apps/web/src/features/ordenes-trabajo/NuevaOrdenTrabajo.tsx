"use client";

import { useRouter } from "next/navigation";
import { OrdenTrabajoForm } from "./OrdenTrabajoForm";

/** Recepción: al guardar va a la ficha (comprobante y aviso al cliente). */
export function NuevaOrdenTrabajo() {
  const router = useRouter();
  return <OrdenTrabajoForm onListo={(id) => router.push(`/ordenes-trabajo/${id}`)} />;
}
