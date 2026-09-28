import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { categoriasDe, listarProductos, productosDestacados } from "@/lib/productos";
import { obtenerSitio, type Sitio } from "@/lib/sitio";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const sitio = await obtenerSitio();
  if (!sitio) notFound();
  const productos = await listarProductos(sitio);
  const destacados = productosDestacados(productos, 4);
  const categorias = categoriasDe(productos);
  const portada = destacados.find((p) => p.imagenes[0])?.imagenes[0] ?? null;
  const ver = (seccion: Sitio["seccionesOcultas"][number]) => !sitio.seccionesOcultas.includes(seccion);
  const sobre = sitio.sobreNosotros || sitio.descripcion;

  return (
    <>
      {sitio.portadaUrl ? (
        // Foto de portada propia: a todo el ancho, con el color de la marca encima para que el texto se lea.
        <section className="relative isolate overflow-hidden text-[var(--crema)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto de portada del negocio, servida por la plataforma */}
          <img src={sitio.portadaUrl} alt="" fetchPriority="high" className="absolute inset-0 -z-10 size-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--marca-hero)_92%,transparent)_0%,color-mix(in_srgb,var(--marca-hero)_70%,transparent)_45%,color-mix(in_srgb,var(--marca-hero)_15%,transparent)_100%)]" />
          <div className="textura -z-10" />
          <div className="mx-auto flex min-h-[26rem] max-w-6xl items-center px-4 py-16 lg:min-h-[32rem]">
            <Presentacion nombre={sitio.nombre} descripcion={sitio.descripcion} />
          </div>
        </section>
      ) : (
        <section className="relative overflow-hidden bg-[var(--marca-hero)] text-[var(--crema)]">
          <div className="textura" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
            <Presentacion nombre={sitio.nombre} descripcion={sitio.descripcion} />
            <div className="aspect-[4/3] overflow-hidden rounded-3xl border border-white/20 bg-[var(--crema)]/10 shadow-inner">
              {portada ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto del producto, servida por la plataforma
                <img src={portada} alt="" fetchPriority="high" className="size-full object-cover" />
              ) : sitio.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sitio.logoUrl} alt="" className="size-full object-contain p-10" />
              ) : (
                <div className="flex h-full items-center justify-center font-serif text-3xl">{sitio.nombre}</div>
              )}
            </div>
          </div>
        </section>
      )}

      {ver("beneficios") ? <Beneficios sitio={sitio} /> : null}

      {ver("categorias") && categorias.length > 1 ? (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="font-serif text-3xl">Categorías</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categorias.map((c) => (
              <Link
                key={c.id}
                href={`/productos?cat=${c.id}`}
                className="group overflow-hidden rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--marca)] hover:shadow-md"
              >
                {c.imagen ? (
                  <span className="block overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element -- foto del producto, servida por la plataforma */}
                    <img src={c.imagen} alt="" loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" />
                  </span>
                ) : (
                  <span className="flex aspect-[4/3] items-center justify-center bg-[var(--marca)]/10 font-serif text-2xl text-[var(--marca-oscuro)]">{c.label.slice(0, 1)}</span>
                )}
                <span className="block px-3 py-3 font-medium">{c.label}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {ver("destacados") ? (
      <section className={`mx-auto max-w-6xl px-4 pb-14 ${ver("categorias") && categorias.length > 1 ? "" : "pt-14"}`}>
        <h2 className="font-serif text-3xl">{sitio.tituloDestacados || "Los más elegidos"}</h2>
        {destacados.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--tinta)]/70">Estamos actualizando el catálogo. Volvé a pasar en un rato.</p>
        ) : (
          <div className="grilla-productos mt-6 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {destacados.map((p) => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
        )}
      </section>
      ) : null}

      {ver("sobre") && (sobre || sitio.textoEnvios) ? (
        <section id="sobre-nosotros" className="bg-white/60">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="font-serif text-3xl">Sobre {sitio.nombre}</h2>
            {sobre ? <p className="mt-4 max-w-2xl whitespace-pre-line leading-7 text-[var(--tinta)]/80">{sobre}</p> : null}
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

function Presentacion({ nombre, descripcion }: { nombre: string; descripcion: string | null }) {
  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-4xl leading-tight sm:text-5xl">{nombre}</h1>
      {descripcion ? <p className="mt-4 text-lg text-[var(--crema)]/90">{descripcion}</p> : null}
      <Link href="/productos" className="mt-8 inline-block rounded-[var(--r-boton)] bg-[var(--crema)] px-6 py-3 text-sm font-semibold text-[var(--marca-oscuro)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white">
        Ver productos
      </Link>
    </div>
  );
}

/** Lo que tranquiliza al que compra: cómo recibe, cómo paga y cómo consulta (solo lo que el negocio cargó). */
function Beneficios({ sitio }: { sitio: Sitio }) {
  const items = [
    sitio.textoEnvios && { icono: "M3 7h11v8H3zM14 10h4l3 3v2h-7M6.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z", titulo: "Envíos y retiro", detalle: sitio.textoEnvios },
    (sitio.alias || sitio.cbu) && { icono: "M3 6h18v12H3zM3 10h18M7 15h3", titulo: "Pagás por transferencia", detalle: "Te mostramos los datos al confirmar el pedido." },
    sitio.whatsapp && { icono: "M4 20l1.3-3.9A8 8 0 1 1 8 19.3L4 20Z", titulo: "Atención por WhatsApp", detalle: "Te respondemos las consultas y coordinamos la entrega." },
  ].filter(Boolean) as { icono: string; titulo: string; detalle: string }[];
  if (items.length < 2) return null;
  return (
    <section aria-label="Cómo comprar" className="border-b border-[var(--marca-oscuro)]/10 bg-white/70">
      <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-3">
        {items.map((i) => (
          <li key={i.titulo} className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--marca)]/10 text-[var(--marca-oscuro)]">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={i.icono} />
              </svg>
            </span>
            <span className="text-sm">
              <b className="block text-[var(--tinta)]">{i.titulo}</b>
              <span className="line-clamp-2 text-[var(--tinta)]/70">{i.detalle}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
