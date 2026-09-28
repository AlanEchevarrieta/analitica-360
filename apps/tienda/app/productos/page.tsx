import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductosCatalogo } from "@/components/ProductosCatalogo";
import { categoriasDe, listarProductos } from "@/lib/productos";
import { obtenerSitio } from "@/lib/sitio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Productos" };

export default async function ProductosPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const sitio = await obtenerSitio();
  if (!sitio) notFound();
  const { cat } = await searchParams;
  const productos = await listarProductos(sitio);
  const categorias = categoriasDe(productos);
  const categoria = categorias.some((c) => c.id === cat) ? cat! : "todos";
  return <ProductosCatalogo productos={productos} categorias={categorias} categoriaInicial={categoria} />;
}
