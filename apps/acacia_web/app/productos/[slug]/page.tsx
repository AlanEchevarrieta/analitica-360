import { notFound } from "next/navigation";
import { obtenerProductoPorSlug, obtenerCatalogo } from "@/lib/api";
import { ProductDetailView } from "@/components/producto/ProductDetailView";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const producto = await obtenerProductoPorSlug(slug);
  if (!producto) return { title: "Producto no encontrado · Acacia Mates" };

  return {
    title: `${producto.nombre} · Acacia Mates`,
    description: producto.descripcion,
  };
}

export async function generateStaticParams() {
  const productos = await obtenerCatalogo();
  return productos.map((p) => ({ slug: p.slug }));
}

export default async function ProductoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const producto = await obtenerProductoPorSlug(slug);

  if (!producto) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-16">
      <ProductDetailView producto={producto} />
    </div>
  );
}
