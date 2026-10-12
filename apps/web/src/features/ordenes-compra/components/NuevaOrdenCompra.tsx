"use client";

import { useRouter } from "next/navigation";
import { OrdenCompraForm } from "./OrdenCompraForm";

/** Alta: al guardar, va a la ficha para mandarla al proveedor. */
export function NuevaOrdenCompra() {
  const router = useRouter();
  return <OrdenCompraForm onListo={(id) => router.push(`/compras/ordenes/${id}`)} />;
}
