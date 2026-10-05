// pnpm --filter tienda test
import assert from "node:assert/strict";
import { test } from "node:test";
import { leerConsulta, paginasVisibles, POR_PAGINA, resolverCatalogo, sugerencias, urlConsulta, type ItemCatalogo } from "./catalogo";

const item = (nombre: string, extra: Partial<ItemCatalogo> = {}): ItemCatalogo => ({
  nombre,
  categoriaTienda: "general",
  categoria: "General",
  precio: 1000,
  stock: 1,
  vendidos: 0,
  creadoEn: "2026-09-01T00:00:00Z",
  descuentoPct: 0,
  ...extra,
});

test("buscar sin tildes ni mayúsculas, con todas las palabras (también en la categoría)", () => {
  const lista = [item("Mate Imperial"), item("Mate de Vidrio"), item("Bolso Matero"), item("Termo", { categoria: "Accesorios materos", categoriaTienda: "accesorios" })];
  assert.deepEqual(resolverCatalogo(lista, leerConsulta({ q: "MATE imperíal" })).items.map((p) => p.nombre), ["Mate Imperial"]);
  assert.deepEqual(resolverCatalogo(lista, leerConsulta({ q: "accesorios" })).items.map((p) => p.nombre), ["Termo"]);
  assert.deepEqual(sugerencias(lista, "mat").map((p) => p.nombre), ["Mate de Vidrio", "Mate Imperial", "Bolso Matero", "Termo"]);
  assert.deepEqual(sugerencias(lista, "m"), []);
});

test("filtros: categoría, precio, stock y ofertas", () => {
  const lista = [
    item("A", { categoriaTienda: "mates", precio: 500 }),
    item("B", { categoriaTienda: "mates", precio: 2000, stock: 0 }),
    item("C", { categoriaTienda: "bolsos", precio: 1500, descuentoPct: 20 }),
  ];
  const nombres = (p: Record<string, string>) => resolverCatalogo(lista, leerConsulta(p)).items.map((x) => x.nombre);
  assert.deepEqual(nombres({ cat: "mates" }), ["A", "B"]);
  assert.deepEqual(nombres({ min: "1000", max: "1800" }), ["C"]);
  assert.deepEqual(nombres({ stock: "1", orden: "nombre" }), ["A", "C"]);
  assert.deepEqual(nombres({ oferta: "1" }), ["C"]);
});

test("orden: más vendidos deja lo agotado al final; novedades, descuento y precio", () => {
  const lista = [
    item("Viejo", { vendidos: 10, stock: 0, creadoEn: "2025-01-01" }),
    item("Nuevo", { vendidos: 1, creadoEn: "2026-10-01", precio: 3000 }),
    item("Oferta", { vendidos: 5, descuentoPct: 30, precio: 100 }),
  ];
  const ordenar = (orden: string) => resolverCatalogo(lista, leerConsulta({ orden })).items.map((x) => x.nombre);
  assert.deepEqual(ordenar("vendidos"), ["Oferta", "Nuevo", "Viejo"]);
  assert.deepEqual(ordenar("novedades"), ["Nuevo", "Oferta", "Viejo"]);
  assert.deepEqual(ordenar("descuento")[0], "Oferta");
  assert.deepEqual(ordenar("mayor")[0], "Nuevo");
});

test("páginas: 12 por página, y una página fuera de rango muestra la última", () => {
  const lista = Array.from({ length: 30 }, (_, i) => item(`P${String(i).padStart(2, "0")}`, { vendidos: 100 - i }));
  const r = resolverCatalogo(lista, leerConsulta({ pag: "9" }));
  assert.equal(r.paginas, 3);
  assert.equal(r.pagina, 3);
  assert.equal(r.items.length, 30 - 2 * POR_PAGINA);
  assert.deepEqual(paginasVisibles(5, 10), [1, "…", 4, 5, 6, "…", 10]);
  assert.deepEqual(paginasVisibles(1, 3), [1, 2, 3]);
  assert.deepEqual(paginasVisibles(4, 5), [1, 2, 3, 4, 5]);
});

test("la URL guarda la consulta y cambiar un filtro vuelve a la página 1", () => {
  const c = leerConsulta({ q: "mate", cat: "mates", pag: "3", orden: "menor" });
  assert.equal(urlConsulta(c, { pag: 4 }), "/productos?q=mate&cat=mates&orden=menor&pag=4");
  assert.equal(urlConsulta(c, { stock: true }), "/productos?q=mate&cat=mates&orden=menor&stock=1");
  assert.equal(urlConsulta(leerConsulta({})), "/productos");
  assert.equal(leerConsulta({ orden: "cualquiera", min: "-5", pag: "x" }).orden, "vendidos");
});
