"use client";

import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { useProducto, useVariantesProducto } from "../hooks/use-producto-editor";
import { ProductoForm } from "./ProductoForm";

/** Carga producto y variantes y recién ahí monta el form (su estado inicial sale de estos datos). */
export function ProductoEditor({ id }: { id: string | null }) {
  const producto = useProducto(id);
  const variantes = useVariantesProducto(id);

  if (!id) return <ProductoForm inicial={null} variantesIniciales={[]} />;
  if (producto.isPending || variantes.isPending) return <CargandoFilas filas={8} />;
  if (producto.isError) return <ErrorDatos error={producto.error} onReintentar={() => producto.refetch()} />;
  if (variantes.isError) return <ErrorDatos error={variantes.error} onReintentar={() => variantes.refetch()} />;
  return <ProductoForm key={producto.data.id} inicial={producto.data} variantesIniciales={variantes.data} />;
}
