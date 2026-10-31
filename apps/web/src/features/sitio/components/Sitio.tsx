import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, Check, ClipboardList, DatabaseBackup, Factory, FileSpreadsheet, History, KeyRound, Lock, Megaphone, MessageCircle, ShieldCheck, Smartphone, Tags, UserCog, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRECIO_MENSUAL } from "@/features/planes/planes";
import { DESTACADAS, DIAS_PRUEBA, EXTRAS, linkWhatsApp, PASOS, PREGUNTAS, SEGURIDAD, UCIM, WHATSAPP, type PreciosLista } from "../contenido";
import { Encabezado } from "./Encabezado";
import { Logo } from "./Logo";
import { MaquetaDestacada, MaquetaInicio, MaquetaVentaCelular } from "./Maquetas";
import { Planes } from "./Planes";

const ICONOS_EXTRAS: Record<string, typeof Check> = {
  clientes: Users,
  precios: Tags,
  produccion: Factory,
  pedidos: ClipboardList,
  whatsapp: Megaphone,
  excel: FileSpreadsheet,
  equipo: UserCog,
  celular: Smartphone,
};

const ICONOS_SEGURIDAD = [DatabaseBackup, History, Lock, KeyRound];

function Titulo({ etiqueta, titulo, bajada, className }: { etiqueta: string; titulo: string; bajada?: string; className?: string }) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <p className="text-sm font-semibold tracking-wide text-indigo-600 uppercase">{etiqueta}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance text-slate-900 sm:text-4xl">{titulo}</h2>
      {bajada && <p className="mt-4 text-lg text-pretty text-slate-600">{bajada}</p>}
    </div>
  );
}

/** Landing pública de Analítica 360 (analitica360.app). Clara siempre, sin depender del tema de la app. */
export function Sitio({ precios }: { precios?: PreciosLista }) {
  const datosEstructurados = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Analítica 360",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Android, iOS",
        description: "Sistema de gestión para comercios: ventas, stock, compras, clientes, analytics, contabilidad y tienda online.",
        offers: { "@type": "Offer", price: String(precios?.basico ?? PRECIO_MENSUAL.basico), priceCurrency: "ARS" },
      },
      { "@type": "FAQPage", mainEntity: PREGUNTAS.map((q) => ({ "@type": "Question", name: q.p, acceptedAnswer: { "@type": "Answer", text: q.r } })) },
    ],
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 [color-scheme:light]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados) }} />
      <Encabezado />

      <main>
        {/* Portada */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 -top-40 -z-0 h-[36rem] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_60%)]" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:pt-20 lg:pb-24">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-800 shadow-xs">
                <Logo conNombre={false} className="size-4 shrink-0" />
                <span>Analítica 360 · Plataforma de Gestión Comercial</span>
              </div>
              <p className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-3">
                <BadgeCheck className="size-4 text-emerald-600 shrink-0" /> Beneficio especial para socios de la UCIM
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-balance text-slate-900 sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]">
                Todo tu comercio, <span className="bg-gradient-to-r from-cyan-500 via-teal-500 to-sky-600 bg-clip-text text-transparent">en un solo lugar</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-pretty text-slate-600">
                Ventas, stock, compras, clientes, números claros y tu tienda online, conectados entre sí. Desde la compu o el celular, pensado para comercios argentinos.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link prefetch={false} href="/sign-up" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-700">
                  Probar {DIAS_PRUEBA} días gratis <ArrowRight className="size-4" />
                </Link>
                <a href={linkWhatsApp()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-base font-semibold text-slate-800 hover:bg-slate-50">
                  <MessageCircle className="size-4 text-emerald-600" /> Hablar por WhatsApp
                </a>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                {["Sin tarjeta", "Sin instalar nada", "Hecho en Mendoza"].map((x) => (
                  <li key={x} className="flex items-center gap-1.5">
                    <Check className="size-4 text-emerald-600" /> {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <MaquetaInicio />
              <MaquetaVentaCelular className="absolute -bottom-10 -left-6 hidden rotate-[-4deg] sm:block lg:-left-12" />
            </div>
          </div>
        </section>

        {/* Franja de confianza */}
        <section className="border-y border-slate-100 bg-slate-50/70">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-center sm:grid-cols-3 sm:px-6">
            {[
              [Building2, "Alianza con la UCIM", "Beneficios para los socios de la Unión Comercial e Industrial de Mendoza."],
              [ShieldCheck, "Tus datos, protegidos", "Copias diarias, conexión cifrada y bitácora de cada cambio."],
              [MessageCircle, "Soporte cercano", "Gente de verdad que te responde por WhatsApp."],
            ].map(([Icono, t, d]) => {
              const I = Icono as typeof Check;
              return (
                <div key={t as string} className="flex flex-col items-center gap-1.5">
                  <I className="size-6 text-indigo-600" />
                  <p className="font-semibold text-slate-900">{t as string}</p>
                  <p className="text-sm text-slate-500">{d as string}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Funciones */}
        <section id="funciones" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Titulo etiqueta="Funciones" titulo="Lo que necesitás para manejar tu negocio" bajada="Cargás una vez y todo se conecta: cada venta actualiza el stock, la caja, tu ganancia y tus números contables." />
            <div className="mt-16 flex flex-col gap-20 sm:gap-28">
              {DESTACADAS.map((d, i) => (
                <div key={d.id} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                  <div className={cn(i % 2 === 1 && "lg:order-2")}>
                    <p className="text-sm font-semibold tracking-wide text-indigo-600 uppercase">{d.etiqueta}</p>
                    <h3 className="mt-2 text-2xl font-bold tracking-tight text-balance text-slate-900 sm:text-3xl">{d.titulo}</h3>
                    <p className="mt-4 text-lg text-pretty text-slate-600">{d.texto}</p>
                    <ul className="mt-6 flex flex-col gap-3">
                      {d.puntos.map((p) => (
                        <li key={p} className="flex gap-3 text-slate-700">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                            <Check className="size-3 text-indigo-700" strokeWidth={3} />
                          </span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={cn(i % 2 === 1 && "lg:order-1")}>
                    <MaquetaDestacada id={d.id} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-24 rounded-3xl border border-slate-200 bg-slate-50/60 p-8 sm:p-12">
              <h3 className="text-center text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Y además</h3>
              <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-x-8 sm:gap-y-10 lg:grid-cols-4">
                {EXTRAS.map((e) => {
                  const I = ICONOS_EXTRAS[e.icono] ?? Check;
                  return (
                    <div key={e.titulo} className="flex flex-col gap-3">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200">
                        <I className="size-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">{e.titulo}</p>
                        <p className="mt-1 text-sm text-slate-500">{e.texto}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Cómo empezás */}
        <section className="bg-gradient-to-b from-violet-50/80 to-white py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Titulo etiqueta="Cómo empezás" titulo="En marcha el mismo día" />
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {PASOS.map((p, i) => (
                <li key={p.titulo} className="relative rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                  <span className="text-5xl font-bold text-indigo-100 tabular-nums">0{i + 1}</span>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{p.titulo}</h3>
                  <p className="mt-1.5 text-sm text-slate-600">{p.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Seguridad */}
        <section className="bg-slate-950 py-20 sm:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold tracking-wide text-indigo-300 uppercase">Seguridad</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Tu información, cuidada como corresponde</h2>
              <p className="mt-4 text-lg text-slate-300">Cumplimos la Ley 25.326 de protección de datos personales y revisamos la seguridad del sistema todas las semanas.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {SEGURIDAD.map((s, i) => {
                const I = ICONOS_SEGURIDAD[i] ?? ShieldCheck;
                return (
                  <div key={s.titulo} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <I className="size-6 text-indigo-300" />
                    <h3 className="mt-4 font-semibold text-white">{s.titulo}</h3>
                    <p className="mt-1.5 text-sm text-slate-300">{s.texto}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Planes */}
        <section id="planes" className="scroll-mt-20 bg-gradient-to-b from-violet-50/80 via-white to-white pt-20 pb-10 sm:pt-28 sm:pb-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Titulo etiqueta="Planes" titulo="Precios simples, sin sorpresas" bajada={`Probá ${DIAS_PRUEBA} días gratis con todo el plan Pro. Después elegís el que te sirve y lo cambiás cuando quieras.`} className="mb-10" />
            <Planes precios={precios} />
          </div>
        </section>

        {/* UCIM */}
        <section id="ucim" className="scroll-mt-20 pt-6 pb-20 sm:pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-8 text-white sm:p-12">
              <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
                <div>
                  <p className="text-sm font-semibold tracking-wide text-indigo-200 uppercase">Socios de la UCIM</p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">¿Sos socio de la Unión Comercial e Industrial de Mendoza?</h2>
                  <p className="mt-4 text-lg text-indigo-100">Por nuestra alianza con la UCIM, tenés un mes gratis y descuentos especiales durante tus primeros {UCIM.mesesBeneficio} meses.</p>
                  <p className="mt-4 text-sm text-indigo-200">Pedí tu código de socio en la UCIM y cargalo al crear tu cuenta.</p>
                </div>
                <ul className="grid gap-3">
                  {[
                    ["1 mes gratis", "En lugar de 14 días"],
                    [`${UCIM.descuento.mensual * 100} % menos`, "Pagando por mes"],
                    [`${UCIM.descuento.trimestral * 100} % menos`, "Pagando por trimestre"],
                    [`${UCIM.descuento.anual * 100} % menos`, "Pagando por año"],
                  ].map(([a, b]) => (
                    <li key={a} className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-5 py-3.5 backdrop-blur">
                      <span className="shrink-0 text-xl font-bold">{a}</span>
                      <span className="text-right text-sm text-indigo-100">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Preguntas */}
        <section id="preguntas" className="scroll-mt-20 bg-slate-50 py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Titulo etiqueta="Preguntas frecuentes" titulo="Lo que más nos preguntan" />
            <div className="mt-10 flex flex-col gap-3">
              {PREGUNTAS.map((q) => (
                <details key={q.p} className="group rounded-xl border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium text-slate-900">
                    {q.p}
                    <span className="text-xl text-indigo-600 transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="px-5 pb-5 text-slate-600">{q.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Cierre */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight text-balance text-slate-900 sm:text-4xl">Empezá hoy a ver tu negocio con claridad</h2>
            <p className="mt-4 text-lg text-slate-600">{DIAS_PRUEBA} días gratis con todo incluido. Sin tarjeta, sin compromiso.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link prefetch={false} href="/sign-up" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-700">
                Crear mi cuenta gratis <ArrowRight className="size-4" />
              </Link>
              <a href={linkWhatsApp()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-3.5 font-semibold text-slate-800 hover:bg-slate-50">
                <MessageCircle className="size-4 text-emerald-600" /> Prefiero que me llamen
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <Logo className="text-slate-900" />
            <p>Sistema de gestión para comercios · Mendoza, Argentina</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Pie de página">
            <a href="#planes" className="hover:text-slate-900">Planes</a>
            <Link prefetch={false} href="/terminos" className="hover:text-slate-900">Términos y condiciones</Link>
            <Link prefetch={false} href="/privacidad" className="hover:text-slate-900">Privacidad</Link>
            {WHATSAPP && (
              <a href={linkWhatsApp()} target="_blank" rel="noopener noreferrer" className="hover:text-slate-900">
                WhatsApp
              </a>
            )}
            <Link prefetch={false} href="/sign-in" className="hover:text-slate-900">Ingresar</Link>
          </nav>
        </div>
        <p className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">© {new Date().getFullYear()} Analítica 360</p>
      </footer>
    </div>
  );
}
