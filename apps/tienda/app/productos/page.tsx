import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductosCatalogo } from "@/components/ProductosCatalogo";
import { leerConsulta } from "@/lib/catalogo";
import { categoriasDe, listarProductos } from "@/lib/productos";
import { obtenerSitio } from "@/lib/sitio";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const c = leerConsulta(await searchParams);
  if (c.q) return { title: `Buscar “${c.q}”`, robots: { index: false } };
  const sitio = await obtenerSitio();
  const categoria = c.cat && sitio ? categoriasDe(await listarProductos(sitio, 120)).find((x) => x.id === c.cat) : null;
  return { title: categoria?.label ?? "Productos" };
}

export default async function ProductosPage({ searchParams }: Props) {
  const sitio = await obtenerSitio();
  if (!sitio) notFound();
  const consulta = leerConsulta(await searchParams);
  const productos = await listarProductos(sitio);
  return <ProductosCatalogo productos={productos} categorias={categoriasDe(productos)} consulta={consulta} />;
}
