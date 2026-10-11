"use client";

import { useRouter } from "next/navigation";
import { PresupuestoForm } from "./PresupuestoForm";

/** Alta: al guardar, va a la ficha para mandarlo al cliente. */
export function NuevoPresupuesto() {
  const router = useRouter();
  return <PresupuestoForm onListo={(id) => router.push(`/ventas/presupuestos/${id}`)} />;
}
