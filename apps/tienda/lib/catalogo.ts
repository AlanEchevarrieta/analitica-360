// Lógica del catálogo (sin React ni red): búsqueda, filtros, orden y páginas.
// Todo el estado vive en la URL (?q=&cat=&orden=&pag=&min=&max=&stock=1&oferta=1)
// para que se pueda compartir un link y el botón "atrás" funcione.

export type Orden = "vendidos" | "novedades" | "descuento" | "menor" | "mayor" | "nombre";

export const ORDENES: { id: Orden; label: string }[] = [
  { id: "vendidos", label: "Más vendidos" },
  { id: "novedades", label: "Novedades" },
  { id: "descuento", label: "Mayor descuento" },
  { id: "menor", label: "Menor precio" },
  { id: "mayor", label: "Mayor precio" },
  { id: "nombre", label: "Nombre (A–Z)" },
];

export const POR_PAGINA = 12;

/** Lo mínimo que necesita el catálogo de cada producto. */
export type ItemCatalogo = {
  nombre: string;
  /** Clave de la categoría ("mates-y-bombillas", "sin-categoria") y su nombre. */
  categoriaTienda: string;
  categoria: string | null;
  precio: number;
  stock: number;
  vendidos: number;
  creadoEn: string;
  descuentoPct: number;
};

export type Consulta = {
  q: string;
  cat: string;
  orden: Orden;
  pag: number;
  min: number | null;
  max: number | null;
  stock: boolean;
  /** Solo productos en oferta. */
  oferta: boolean;
};

/** Sin tildes, minúsculas y espacios simples: "Mate Imperial" ≈ "mate imperíal". */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Todas las palabras buscadas tienen que estar en el nombre o en la categoría. */
export function coincide(item: Pick<ItemCatalogo, "nombre" | "categoria">, q: string): boolean {
  const palabras = normalizar(q).split(" ").filter(Boolean);
  if (palabras.length === 0) return true;
  const texto = normalizar(`${item.nombre} ${item.categoria ?? ""}`);
  return palabras.every((p) => texto.includes(p));
}

const entero = (v: string | undefined) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

export function leerConsulta(params: Record<string, string | string[] | undefined>): Consulta {
  const uno = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const orden = ORDENES.some((o) => o.id === uno("orden")) ? (uno("orden") as Orden) : "vendidos";
  return {
    q: (uno("q") ?? "").slice(0, 80),
    cat: uno("cat") ?? "",
    orden,
    pag: Math.max(1, entero(uno("pag")) ?? 1),
    min: entero(uno("min")),
    max: entero(uno("max")),
    stock: uno("stock") === "1",
    oferta: uno("oferta") === "1",
  };
}

/** Link con la consulta actual y algunos cambios. Cambiar un filtro vuelve a la página 1. */
export function urlConsulta(base: Consulta, cambios: Partial<Consulta> = {}): string {
  const c = { ...base, ...cambios };
  if (!("pag" in cambios)) c.pag = 1;
  const params = new URLSearchParams();
  if (c.q.trim()) params.set("q", c.q.trim());
  if (c.cat) params.set("cat", c.cat);
  if (c.orden !== "vendidos") params.set("orden", c.orden);
  if (c.min != null) params.set("min", String(c.min));
  if (c.max != null) params.set("max", String(c.max));
  if (c.stock) params.set("stock", "1");
  if (c.oferta) params.set("oferta", "1");
  if (c.pag > 1) params.set("pag", String(c.pag));
  const s = params.toString();
  return s ? `/productos?${s}` : "/productos";
}

export function resolverCatalogo<T extends ItemCatalogo>(items: T[], c: Consulta) {
  const filtrados = items.filter(
    (p) =>
      (!c.cat || p.categoriaTienda === c.cat) &&
      coincide(p, c.q) &&
      (c.min == null || p.precio >= c.min) &&
      (c.max == null || p.precio <= c.max) &&
      (!c.stock || p.stock > 0) &&
      (!c.oferta || p.descuentoPct > 0),
  );
  const porNombre = (a: T, b: T) => a.nombre.localeCompare(b.nombre, "es");
  filtrados.sort((a, b) => {
    switch (c.orden) {
      case "menor":
        return a.precio - b.precio || porNombre(a, b);
      case "mayor":
        return b.precio - a.precio || porNombre(a, b);
      case "nombre":
        return porNombre(a, b);
      case "descuento":
        return b.descuentoPct - a.descuentoPct || porNombre(a, b);
      case "novedades":
        return b.creadoEn.localeCompare(a.creadoEn) || porNombre(a, b);
      default:
        // Primero lo que hay en stock: no conviene abrir el catálogo con productos agotados.
        return Number(b.stock > 0) - Number(a.stock > 0) || b.vendidos - a.vendidos || porNombre(a, b);
    }
  });
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const pagina = Math.min(c.pag, paginas);
  const desde = (pagina - 1) * POR_PAGINA;
  return { items: filtrados.slice(desde, desde + POR_PAGINA), total: filtrados.length, pagina, paginas, desde };
}

/** [1, "…", 4, 5, 6, "…", 10]: siempre la primera, la última y las vecinas de la actual. */
export function paginasVisibles(pagina: number, paginas: number): (number | "…")[] {
  const set = new Set([1, paginas, pagina - 1, pagina, pagina + 1].filter((n) => n >= 1 && n <= paginas));
  const lista = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  lista.forEach((n, i) => {
    if (i > 0 && n - lista[i - 1] > 1) out.push(n - lista[i - 1] === 2 ? n - 1 : "…");
    out.push(n);
  });
  return out;
}

/** Sugerencias del buscador: primero las que empiezan con lo escrito. */
export function sugerencias<T extends Pick<ItemCatalogo, "nombre" | "categoria">>(items: T[], q: string, n = 6): T[] {
  const nq = normalizar(q);
  if (nq.length < 2) return [];
  return items
    .filter((p) => coincide(p, q))
    .sort((a, b) => Number(normalizar(b.nombre).startsWith(nq)) - Number(normalizar(a.nombre).startsWith(nq)) || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, n);
}
