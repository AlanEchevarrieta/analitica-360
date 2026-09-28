import { cabecerasTienda, urlTienda } from "./api";
import type { Sitio } from "./sitio";

export type VarianteTienda = {
  id: string;
  sku: string;
  atributos: Record<string, string>;
  precio: number;
  activo: boolean;
  stock: number;
};

export type ProductoTienda = {
  id: string;
  nombre: string;
  categoria: string | null;
  /** Clave de la categoría para filtrar ("mates", "sin-categoria"). */
  categoriaTienda: CategoriaId;
  precio: number;
  /** Fotos en orden (la primera es la principal). */
  imagenes: string[];
  stock: number;
  vendidos: number;
  slug: string;
  variantes: VarianteTienda[];
};

export type CategoriaId = string;

export type CategoriaTienda = { id: CategoriaId; label: string; cantidad: number; imagen: string | null };

export function slugify(nombre: string, id: string) {
  const base = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "producto"}-${id.slice(0, 8)}`;
}

export function formatoARS(valor: number) {
  const n = Math.round(Number.isFinite(valor) ? valor : 0);
  return `$${n.toLocaleString("es-AR")}`;
}

/** Clave estable de una categoría a partir de su nombre ("Mates y bombillas" -> "mates-y-bombillas"). */
export function claveCategoria(categoria: string | null): CategoriaId {
  if (!categoria?.trim()) return "sin-categoria";
  return categoria
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Categorías que tienen productos, de la más grande a la más chica, con una foto de muestra. */
export function categoriasDe(productos: ProductoTienda[]): CategoriaTienda[] {
  const mapa = new Map<CategoriaId, CategoriaTienda>();
  for (const p of productos) {
    const c = mapa.get(p.categoriaTienda) ?? { id: p.categoriaTienda, label: p.categoria?.trim() || "Otros", cantidad: 0, imagen: null };
    c.cantidad += 1;
    c.imagen ??= p.imagenes[0] ?? null;
    mapa.set(p.categoriaTienda, c);
  }
  return [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad || a.label.localeCompare(b.label, "es"));
}

function attrs(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = String(v ?? "");
  }
  return out;
}

export function etiquetaVariante(atributos: Record<string, string>) {
  return Object.keys(atributos)
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((k) => atributos[k])
    .filter(Boolean)
    .join(" / ");
}

function mapVariantes(raw: unknown): VarianteTienda[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const v = item as Record<string, unknown>;
      const id = v.id == null ? "" : String(v.id);
      if (!id) return null;
      return {
        id,
        sku: String(v.sku ?? ""),
        atributos: attrs(v.atributos),
        precio: Number(v.precio ?? 0),
        activo: v.activo !== false,
        stock: Number(v.stock ?? 0),
      };
    })
    .filter((v): v is VarianteTienda => v != null);
}

function mapProducto(row: Record<string, unknown>): ProductoTienda {
  const id = String(row.id);
  const nombre = String(row.nombre ?? "Producto");
  const categoria = row.categoria == null ? null : String(row.categoria);
  const variantes = mapVariantes(row.variantes);
  const stockVars = variantes.filter((v) => v.activo).reduce((acc, v) => acc + v.stock, 0);
  const stockBase = Number(row.stock ?? 0);
  return {
    id,
    nombre,
    categoria,
    categoriaTienda: claveCategoria(categoria),
    precio: Number(row.precio_venta ?? row.precio ?? 0),
    imagenes: Array.isArray(row.imagenes) ? (row.imagenes as unknown[]).map(String) : [],
    stock: variantes.some((v) => v.activo) ? stockVars : stockBase,
    vendidos: Number(row.vendidos ?? 0),
    slug: slugify(nombre, id),
    variantes,
  };
}

/** Catálogo público del negocio (sin insumos ni productos ocultos: lo filtra la API). */
export async function listarProductos(sitio: Sitio): Promise<ProductoTienda[]> {
  try {
    const res = await fetch(urlTienda(sitio.empresaId, "/catalogo"), { cache: "no-store", headers: await cabecerasTienda() });
    if (!res.ok) {
      console.error(`Catálogo: la API respondió ${res.status}`);
      return [];
    }
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    const productos = (data as Record<string, unknown>[]).map(mapProducto);
    return sitio.mostrarSinStock ? productos : productos.filter((p) => p.stock > 0);
  } catch (error) {
    console.error("Catálogo: no se pudo conectar con la API", error);
    return [];
  }
}

export async function obtenerProductoPorSlug(sitio: Sitio, slug: string): Promise<ProductoTienda | null> {
  const productos = await listarProductos(sitio);
  return productos.find((p) => p.slug === slug) ?? null;
}

export function productosDestacados(productos: ProductoTienda[], n = 4) {
  return [...productos]
    .sort((a, b) => b.vendidos - a.vendidos || b.stock - a.stock || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, n);
}
