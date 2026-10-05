import { NextResponse } from "next/server";
import { sugerencias } from "@/lib/catalogo";
import { formatoARS, listarProductos } from "@/lib/productos";
import { obtenerSitio } from "@/lib/sitio";

// Sugerencias del buscador mientras se escribe (catálogo de hace hasta 1 minuto).
export async function GET(request: Request) {
  const sitio = await obtenerSitio();
  if (!sitio) return NextResponse.json([], { status: 404 });
  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 80);
  const productos = await listarProductos(sitio, 60);
  const lista = sugerencias(productos, q).map((p) => ({
    nombre: p.nombre,
    categoria: p.categoria?.trim() || "Otros",
    precio: formatoARS(p.precio),
    href: `/productos/${p.slug}`,
    foto: p.miniaturas[0] ?? null,
  }));
  return NextResponse.json(lista, { headers: { "Cache-Control": "private, max-age=30" } });
}
