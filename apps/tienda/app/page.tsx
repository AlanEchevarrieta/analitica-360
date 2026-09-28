import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { categoriasDe, listarProductos, productosDestacados } from "@/lib/productos";
import { obtenerSitio } from "@/lib/sitio";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sitio = await obtenerSitio();
  if (!sitio) notFound();
  const productos = await listarProductos(sitio);
  const destacados = productosDestacados(productos, 4);
  const categorias = categoriasDe(productos);
  const portada = destacados.find((p) => p.imagenes[0])?.imagenes[0] ?? null;

  return (
    <>
      <section className="relative overflow-hidden bg-[var(--marca-hero)] text-[var(--crema)]">
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(var(--crema)_1px,transparent_1px)] [background-size:14px_14px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="font-serif text-4xl leading-tight sm:text-5xl">{sitio.nombre}</h1>
            {sitio.descripcion ? <p className="mt-4 text-lg text-[var(--crema)]/90">{sitio.descripcion}</p> : null}
            <Link href="/productos" className="mt-8 inline-block rounded-full bg-[var(--crema)] px-6 py-3 text-sm font-semibold text-[var(--marca-oscuro)] hover:bg-white">
              Ver productos
            </Link>
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-3xl border border-white/20 bg-[var(--crema)]/10 shadow-inner">
            {portada ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto del producto, servida por la plataforma
              <img src={portada} alt="" className="size-full object-cover" />
            ) : sitio.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sitio.logoUrl} alt="" className="size-full object-contain p-10" />
            ) : (
              <div className="flex h-full items-center justify-center font-serif text-3xl">{sitio.nombre}</div>
            )}
          </div>
        </div>
      </section>

      {categorias.length > 1 ? (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="font-serif text-3xl">Categorías</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categorias.map((c) => (
              <Link
                key={c.id}
                href={`/productos?cat=${c.id}`}
                className="overflow-hidden rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--marca)]"
              >
                {c.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imagen} alt="" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <span className="flex aspect-[4/3] items-center justify-center bg-[var(--marca)]/10 font-serif text-2xl text-[var(--marca-oscuro)]">{c.label.slice(0, 1)}</span>
                )}
                <span className="block px-3 py-3 font-medium">{c.label}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className={`mx-auto max-w-6xl px-4 pb-14 ${categorias.length > 1 ? "" : "pt-14"}`}>
        <h2 className="font-serif text-3xl">Los más elegidos</h2>
        {destacados.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--tinta)]/70">Estamos actualizando el catálogo. Volvé a pasar en un rato.</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {destacados.map((p) => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
        )}
      </section>

      {sitio.descripcion || sitio.textoEnvios ? (
        <section id="sobre-nosotros" className="bg-white/60">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="font-serif text-3xl">Sobre {sitio.nombre}</h2>
            {sitio.descripcion ? <p className="mt-4 max-w-2xl leading-7 text-[var(--tinta)]/80">{sitio.descripcion}</p> : null}
            {sitio.textoEnvios ? (
              <p className="mt-4 max-w-2xl leading-7 text-[var(--tinta)]/80">
                <b>Envíos y retiro:</b> {sitio.textoEnvios}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
