"use client";

import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ACTIVIDADES_POR_DEFECTO, type Actividad } from "@/lib/rubros";
import type { Configuracion } from "../hooks/use-configuracion";
import { useConfiguracion } from "../hooks/use-configuracion";
import { ActividadesConfig } from "./ActividadesConfig";
import { AparienciaConfig } from "./AparienciaConfig";
import { EquipoConfig, ExportarConfig } from "./EquipoExportarConfig";
import { AtributosConfig, CategoriasConfig, UbicacionesConfig } from "./ListasConfig";
import { ListasPreciosConfig } from "./ListasPreciosConfig";
import { ProduccionConfig } from "./ProduccionConfig";
import { TiendaOnlineConfig } from "./TiendaOnlineConfig";
import { CuotasConfig, MediosConfig } from "./MediosCuotasConfig";
import { FlujoVentasConfig, InventarioPedidosConfig } from "./OperacionConfig";
import { FiscalConfig, RemitenteConfig } from "./RemitenteFiscalConfig";
import { AuditoriaConfig } from "./AuditoriaConfig";
import { CuponesTiendaConfig } from "./CuponesTiendaConfig";
import { DocumentosConfig } from "./DocumentosConfig";
import { InformesConfig } from "./InformesConfig";
import { AgendaConfig } from "@/features/agenda/AgendaConfig";
import { FacturaElectronicaConfig } from "@/features/facturacion/FacturaElectronicaConfig";
import { EnviosConfig } from "@/features/envios/EnviosConfig";
import { MercadoPagoTiendaConfig } from "@/features/mercadopago-tienda/MercadoPagoTiendaConfig";
import { BorrarCuentaConfig } from "./BorrarCuentaConfig";
import { CandadoPlan, MejorarPlan } from "@/components/shared/mejorar-plan";
import { usePlan } from "@/hooks/use-plan";

interface Opcion {
  clave: string;
  icono: string;
  titulo: string;
  subtitulo: string;
  /** `pedida`: la clave o el alias con que se abrió (para ir directo a esa parte). */
  panel: (config: Configuracion, pedida: string | null) => ReactNode;
  /** Función del plan que necesita (sin ella: candado y "mejorar plan"). */
  funcion?: string;
  /** Solo para negocios con alguna de estas actividades, como el menú. Si se pide por link, se abre igual. */
  para?: Actividad[];
  /** Claves anteriores que siguen abriendo esta opción (links viejos y de otras pantallas). */
  alias?: string[];
}

const CON_STOCK: Actividad[] = ["productos", "produccion"];

/** Opciones agrupadas por tema; la clave va en la URL (?s=tienda) para poder linkear directo. */
const GRUPOS: { titulo: string; opciones: Opcion[] }[] = [
  {
    titulo: "Ventas y cobros",
    opciones: [
      {
        clave: "cobros",
        alias: ["medios", "cuotas"],
        icono: "💳",
        titulo: "Cobros",
        subtitulo: "Medios de pago que aceptás y el interés de cada cantidad de cuotas",
        panel: (c) => (
          <Partes
            partes={[
              { titulo: "Medios de pago", panel: <MediosConfig config={c} /> },
              { titulo: "Cuotas y tasas", panel: <CuotasConfig config={c} /> },
            ]}
          />
        ),
      },
      { clave: "flujo", icono: "💸", titulo: "Flujo de ventas", subtitulo: "Qué se pide al cargar una venta", panel: (c) => <FlujoVentasConfig config={c} /> },
      { clave: "precios", icono: "💲", titulo: "Listas de precios", subtitulo: "Mayorista, revendedor: precios distintos por cliente", panel: () => <ListasPreciosConfig />, funcion: "listas_precios" },
    ],
  },
  {
    titulo: "Productos y stock",
    opciones: [
      {
        clave: "catalogo",
        alias: ["categorias", "variantes"],
        icono: "🏷️",
        titulo: "Catálogo",
        subtitulo: "Categorías y variantes (color, talle, material) para organizar tus productos",
        panel: () => (
          <Partes
            partes={[
              { titulo: "Categorías", panel: <CategoriasConfig /> },
              { titulo: "Variantes", panel: <AtributosConfig /> },
            ]}
          />
        ),
      },
      {
        clave: "stock",
        alias: ["inventario", "ubicaciones"],
        icono: "📦",
        titulo: "Stock y depósitos",
        subtitulo: "Stock bajo, asignación de pedidos y tus depósitos, locales y stands",
        para: CON_STOCK,
        panel: (c) => (
          <Partes
            partes={[
              { titulo: "Inventario y pedidos", panel: <InventarioPedidosConfig config={c} /> },
              { titulo: "Ubicaciones", panel: <UbicacionesConfig /> },
            ]}
          />
        ),
      },
      { clave: "produccion", icono: "🔨", titulo: "Producción", subtitulo: "Valor de la hora de trabajo para el costo de fabricar", panel: (c) => <ProduccionConfig config={c} />, para: ["produccion"] },
    ],
  },
  {
    titulo: "Turnos y servicios",
    opciones: [
      { clave: "agenda", icono: "📅", titulo: "Profesionales y horarios", subtitulo: "Quién atiende, en qué horario y la reserva online", panel: () => <AgendaConfig />, funcion: "agenda", para: ["servicios"] },
    ],
  },
  {
    titulo: "Tienda online",
    opciones: [
      {
        clave: "tienda",
        alias: ["cupones"],
        icono: "🛍️",
        titulo: "Tienda online",
        subtitulo: "Tu catálogo en internet: marca, contacto, datos para cobrar y cupones",
        funcion: "tienda",
        panel: (_c, pedida) => (
          <Partes
            enPestanas
            inicial={pedida === "cupones" ? 1 : 0}
            partes={[
              { titulo: "Tienda", panel: <TiendaOnlineConfig /> },
              { titulo: "Cupones de descuento", panel: <CuponesTiendaConfig /> },
            ]}
          />
        ),
      },
      { clave: "mercadopago", icono: "💳", titulo: "Cobros con Mercado Pago", subtitulo: "Que tus clientes paguen la tienda con tarjeta o dinero en cuenta", panel: () => <MercadoPagoTiendaConfig />, funcion: "tienda" },
      { clave: "envios", icono: "🚚", titulo: "Envíos", subtitulo: "Correo Argentino, Andreani y más con Zipnova: cotizar, etiqueta y seguimiento", panel: () => <EnviosConfig />, funcion: "pedidos", para: CON_STOCK },
    ],
  },
  {
    titulo: "Mi negocio",
    opciones: [
      { clave: "actividades", icono: "🧭", titulo: "Qué hace mi negocio", subtitulo: "Vendo productos, fabrico o doy servicios: arma el menú", panel: (c) => <ActividadesConfig config={c} /> },
      {
        clave: "comprobantes",
        alias: ["remitente", "documentos"],
        icono: "📄",
        titulo: "Comprobantes",
        subtitulo: "Quién figura en los documentos, y el logo y los textos del comprobante, el recibo y el presupuesto",
        panel: (c) => (
          <Partes
            partes={[
              { titulo: "Datos del remitente", panel: <RemitenteConfig config={c} /> },
              { titulo: "Logo y textos", panel: <DocumentosConfig /> },
            ]}
          />
        ),
      },
      {
        clave: "impuestos",
        alias: ["fiscal", "factura"],
        icono: "🧾",
        titulo: "Impuestos y facturación",
        subtitulo: "País, moneda e IVA, y la Factura C de ARCA desde cada venta",
        panel: (c) => (
          <Partes
            partes={[
              { titulo: "Configuración fiscal", panel: <FiscalConfig config={c} /> },
              { titulo: "Factura electrónica", panel: <FacturaElectronicaConfig /> },
            ]}
          />
        ),
      },
      { clave: "informes", icono: "📧", titulo: "Informes por email", subtitulo: "El resumen de la semana y del mes, en PDF, a tu email", panel: () => <InformesConfig /> },
      { clave: "apariencia", icono: "🖌️", titulo: "Apariencia", subtitulo: "Modo claro u oscuro y colores de la app", panel: () => <AparienciaConfig /> },
    ],
  },
  {
    titulo: "Equipo y datos",
    opciones: [
      { clave: "equipo", icono: "👥", titulo: "Equipo", subtitulo: "Invitá al equipo y asigná roles", panel: () => <EquipoConfig /> },
      { clave: "auditoria", icono: "🔍", titulo: "Auditoría", subtitulo: "Quién cambió qué y cuándo, con el antes y el después", panel: () => <AuditoriaConfig />, funcion: "auditoria" },
      {
        clave: "cuenta",
        alias: ["exportar", "borrar"],
        icono: "📥",
        titulo: "Mis datos y mi cuenta",
        subtitulo: "Descargá tu historial cuando quieras. Tus datos son tuyos, siempre.",
        panel: () => (
          <Partes
            partes={[
              { titulo: "Exportar mis datos", panel: <ExportarConfig /> },
              { titulo: "Borrar mi cuenta", panel: <BorrarCuentaConfig /> },
            ]}
          />
        ),
      },
    ],
  },
];
const OPCIONES = GRUPOS.flatMap((g) => g.opciones);

/**
 * Dos o más paneles en una misma opción: uno debajo del otro con su título, o en pestañas
 * cuando cada parte es larga (la tienda).
 */
function Partes({ partes, enPestanas = false, inicial = 0 }: { partes: { titulo: string; panel: ReactNode }[]; enPestanas?: boolean; inicial?: number }) {
  const [elegida, setElegida] = useState(inicial);
  if (enPestanas) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1" role="tablist">
          {partes.map((p, i) => (
            <Button key={p.titulo} size="sm" role="tab" variant={i === elegida ? "default" : "outline"} aria-selected={i === elegida} onClick={() => setElegida(i)}>
              {p.titulo}
            </Button>
          ))}
        </div>
        <div role="tabpanel">{partes[elegida]?.panel}</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {partes.map((p, i) => (
        <section key={p.titulo} className={cn("flex flex-col gap-3", i > 0 && "border-t pt-6")}>
          <h3 className="font-medium">{p.titulo}</h3>
          {p.panel}
        </section>
      ))}
    </div>
  );
}

/**
 * Configuración en una sola pantalla: menú por temas a la izquierda y la opción elegida a la derecha.
 * En el celular es lista → detalle (con "volver"). Solo se listan las opciones que corresponden a lo
 * que hace el negocio, como en el menú principal.
 */
export function ConfiguracionVista() {
  const router = useRouter();
  const s = useSearchParams().get("s");
  const pedida = s ? OPCIONES.find((o) => o.clave === s || o.alias?.includes(s)) : undefined;
  const { data: config, isPending, isError, error, refetch } = useConfiguracion();
  const plan = usePlan();
  if (isPending) return <CargandoFilas filas={8} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  const actividades = config.actividades ?? ACTIVIDADES_POR_DEFECTO;
  const corresponde = (o: Opcion) => !o.para || o.para.some((a) => actividades.includes(a));
  const grupos = GRUPOS.map((g) => ({ ...g, opciones: g.opciones.filter(corresponde) })).filter((g) => g.opciones.length > 0);
  const actual = pedida ?? grupos[0].opciones[0];
  const ir = (clave: string | null) => router.replace(clave ? `/configuracion?s=${clave}` : "/configuracion", { scroll: false });

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label="Opciones de configuración" className={cn("flex flex-col gap-3 lg:sticky lg:top-4", pedida && "max-lg:hidden")}>
        {grupos.map((g) => (
          <div key={g.titulo}>
            <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.titulo}</p>
            <ul className="flex flex-col">
              {g.opciones.map((o) => (
                <li key={o.clave}>
                  <button
                    type="button"
                    onClick={() => ir(o.clave)}
                    aria-current={o.clave === actual.clave ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted lg:py-1.5",
                      o.clave === actual.clave && "lg:bg-muted lg:font-medium",
                    )}
                  >
                    <span aria-hidden>{o.icono}</span>
                    <span className="flex-1">{o.titulo}</span>
                    {o.funcion && !plan.incluye(o.funcion) && <CandadoPlan funcion={o.funcion} />}
                    <ChevronRight className="size-4 text-muted-foreground lg:hidden" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <section aria-labelledby="config-titulo" className={cn("rounded-xl bg-card ring-1 ring-foreground/10", !pedida && "max-lg:hidden")}>
        <header className="flex items-center gap-3 border-b p-4">
          <button type="button" onClick={() => ir(null)} className="-ml-1 rounded-md p-1 hover:bg-muted lg:hidden" aria-label="Volver a todas las opciones">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <span className="text-xl" aria-hidden>
            {actual.icono}
          </span>
          <div>
            <h2 id="config-titulo" className="font-medium">
              {actual.titulo}
            </h2>
            <p className="text-sm text-muted-foreground">{actual.subtitulo}</p>
          </div>
        </header>
        {/* key: al cambiar de opción, las pestañas internas vuelven a su estado inicial. */}
        <div className="p-4" key={actual.clave}>
          {actual.funcion && !plan.listo ? null : actual.funcion && !plan.incluye(actual.funcion) ? <MejorarPlan funcion={actual.funcion} compacto /> : actual.panel(config, s)}
        </div>
      </section>
    </div>
  );
}
