import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FichaProducto } from "@/components/FichaProducto";
import { obtenerProductoPorSlug } from "@/lib/productos";
import { obtenerSitio } from "@/lib/sitio";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const sitio = await obtenerSitio();
  const { slug } = await params;
  const producto = sitio ? await obtenerProductoPorSlug(sitio, slug) : null;
  if (!producto) return { title: "Producto" };
  return { title: producto.nombre, openGraph: producto.imagenes[0] ? { images: [producto.imagenes[0]] } : undefined };
}

export default async function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const sitio = await obtenerSitio();
  if (!sitio) notFound();
  const { slug } = await params;
  const producto = await obtenerProductoPorSlug(sitio, slug);
  if (!producto) notFound();
  return <FichaProducto producto={producto} />;
}
