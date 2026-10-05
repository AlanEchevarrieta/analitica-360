import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AccionesCuenta, DatosCuentaForm } from "@/components/CuentaFormularios";
import { Migas } from "@/components/Migas";
import { ProductCard } from "@/components/ProductCard";
import { formatoARS, listarProductos } from "@/lib/productos";
import { cuentaActual, idsFavoritos, misPedidos } from "@/lib/sesion";
import { obtenerSitio } from "@/lib/sitio";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

const ESTADO: Record<string, { texto: string; clase: string }> = {
  nuevo: { texto: "Recibido", clase: "bg-[var(--tinta)]/10 text-[var(--tinta)]/75" },
  en_preparacion: { texto: "En preparación", clase: "bg-amber-100 text-amber-800" },
  listo_despacho: { texto: "Listo para enviar", clase: "bg-amber-100 text-amber-800" },
  despachado: { texto: "Enviado", clase: "bg-sky-100 text-sky-800" },
  con_transportista: { texto: "En camino", clase: "bg-sky-100 text-sky-800" },
  entregado: { texto: "Entregado", clase: "bg-emerald-100 text-emerald-800" },
  cancelado: { texto: "Cancelado", clase: "bg-red-100 text-red-700" },
};
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
const tarjeta = "rounded-2xl border border-[var(--marca-oscuro)]/10 bg-white p-5 shadow-sm sm:p-6";

export default async function MiCuentaPage() {
  const sitio = await obtenerSitio();
  if (!sitio) notFound();
  const cuenta = await cuentaActual();
  if (!cuenta) redirect("/ingresar?volver=/mi-cuenta");
  const [pedidos, favoritos, productos] = await Promise.all([misPedidos(), idsFavoritos(), listarProductos(sitio)]);
  const deFavoritos = favoritos.map((id) => productos.find((p) => p.id === id)).filter((p) => p != null);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <Migas pasos={[{ label: "Mi cuenta" }]} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--tinta)]/55">{cuenta.email}</p>
          <h1 className="mt-1 font-serif text-3xl text-[var(--tinta)] sm:text-4xl">Hola{cuenta.nombre ? `, ${cuenta.nombre.split(" ")[0]}` : ""}</h1>
        </div>
        <AccionesCuenta />
      </header>

      <section className={tarjeta} aria-labelledby="titulo-pedidos">
        <h2 id="titulo-pedidos" className="font-serif text-xl text-[var(--tinta)]">
          Mis pedidos <span className="text-base text-[var(--tinta)]/45">· {pedidos.length}</span>
        </h2>
        {pedidos.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--tinta)]/65">
            Todavía no hiciste pedidos.{" "}
            <Link href="/productos" className="font-medium text-[var(--marca)] underline">
              Ver productos
            </Link>
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--marca-oscuro)]/10">
            {pedidos.map((p) => {
              const e = ESTADO[p.estado] ?? { texto: p.estado, clase: "bg-[var(--tinta)]/10" };
              return (
                <li key={p.numero} className="grid gap-3 py-4 md:grid-cols-[11rem_1fr_auto]">
                  <div>
                    <p className="font-semibold tabular-nums">{p.numero}</p>
                    <p className="text-xs text-[var(--tinta)]/55">{fecha(p.fecha)}</p>
                    <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${e.clase}`}>{e.texto}</span>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {p.items.map((i, k) => (
                      <li key={k} className="flex justify-between gap-4">
                        <span>
                          {i.cantidad}× {i.nombre}
                          {i.variante ? <span className="text-[var(--tinta)]/55"> ({i.variante})</span> : null}
                        </span>
                        <span className="tabular-nums text-[var(--tinta)]/65">{formatoARS(i.cantidad * i.precio)}</span>
                      </li>
                    ))}
                    {p.numeroSeguimiento ? (
                      <li className="pt-1 text-[var(--tinta)]/65">
                        Seguimiento{p.transportista ? ` (${p.transportista})` : ""}: <span className="font-mono">{p.numeroSeguimiento}</span>
                      </li>
                    ) : null}
                  </ul>
                  <div className="text-right">
                    {p.descuentos > 0 ? <p className="text-xs text-[var(--marca)]">Descuentos −{formatoARS(p.descuentos)}</p> : null}
                    <p className="text-lg font-semibold tabular-nums">{formatoARS(p.total)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-favoritos">
        <h2 id="titulo-favoritos" className="font-serif text-xl text-[var(--tinta)]">
          Mis favoritos <span className="text-base text-[var(--tinta)]/45">· {deFavoritos.length}</span>
        </h2>
        {deFavoritos.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--tinta)]/65">Tocá el corazón de un producto para guardarlo acá.</p>
        ) : (
          <div className="grilla-productos mt-4 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {deFavoritos.map((p) => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
        )}
      </section>

      <section className={`${tarjeta} max-w-3xl`} aria-labelledby="titulo-datos">
        <h2 id="titulo-datos" className="font-serif text-xl text-[var(--tinta)]">
          Mis datos de envío
        </h2>
        <p className="mt-1 text-sm text-[var(--tinta)]/55">Se completan solos cuando hacés un pedido.</p>
        <DatosCuentaForm cuenta={cuenta} />
      </section>
    </div>
  );
}
