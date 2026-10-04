"use client";

import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { cn } from "@/lib/utils";
import type { Configuracion } from "../hooks/use-configuracion";
import { useConfiguracion } from "../hooks/use-configuracion";
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

interface Opcion {
  clave: string;
  icono: string;
  titulo: string;
  subtitulo: string;
  panel: (config: Configuracion) => ReactNode;
}

/** Opciones agrupadas por tema; la clave va en la URL (?s=tienda) para poder linkear directo. */
const GRUPOS: { titulo: string; opciones: Opcion[] }[] = [
  {
    titulo: "Ventas y cobros",
    opciones: [
      { clave: "medios", icono: "💳", titulo: "Medios de pago", subtitulo: "Cómo aceptás pagos", panel: (c) => <MediosConfig config={c} /> },
      { clave: "cuotas", icono: "📊", titulo: "Cuotas y tasas", subtitulo: "Intereses por cantidad de cuotas", panel: (c) => <CuotasConfig config={c} /> },
      { clave: "flujo", icono: "💸", titulo: "Flujo de ventas", subtitulo: "Qué se pide al cargar una venta", panel: (c) => <FlujoVentasConfig config={c} /> },
      { clave: "precios", icono: "💲", titulo: "Listas de precios", subtitulo: "Mayorista, revendedor: precios distintos por cliente", panel: () => <ListasPreciosConfig /> },
    ],
  },
  {
    titulo: "Productos y stock",
    opciones: [
      { clave: "inventario", icono: "📦", titulo: "Inventario y pedidos", subtitulo: "Stock bajo, ubicación de venta y asignación de pedidos", panel: (c) => <InventarioPedidosConfig config={c} /> },
      { clave: "categorias", icono: "🏷️", titulo: "Categorías", subtitulo: "Organizá tus productos", panel: () => <CategoriasConfig /> },
      { clave: "variantes", icono: "🎨", titulo: "Variantes", subtitulo: "Color, talle, material y más", panel: () => <AtributosConfig /> },
      { clave: "ubicaciones", icono: "📍", titulo: "Ubicaciones", subtitulo: "Depósitos, locales y stands", panel: () => <UbicacionesConfig /> },
      { clave: "produccion", icono: "🔨", titulo: "Producción", subtitulo: "Valor de la hora de trabajo para el costo de fabricar", panel: (c) => <ProduccionConfig config={c} /> },
    ],
  },
  {
    titulo: "Tienda online",
    opciones: [
      { clave: "tienda", icono: "🛍️", titulo: "Tienda online", subtitulo: "Tu catálogo en internet: marca, contacto y datos para cobrar", panel: () => <TiendaOnlineConfig /> },
      { clave: "cupones", icono: "🎟️", titulo: "Cupones de la tienda", subtitulo: "Códigos de descuento para el checkout (ej. ACACIA10)", panel: () => <CuponesTiendaConfig /> },
    ],
  },
  {
    titulo: "Mi negocio",
    opciones: [
      { clave: "remitente", icono: "📬", titulo: "Datos del remitente", subtitulo: "Quién figura en el remito", panel: (c) => <RemitenteConfig config={c} /> },
      { clave: "fiscal", icono: "🌎", titulo: "Configuración fiscal", subtitulo: "País, moneda e IVA", panel: (c) => <FiscalConfig config={c} /> },
      { clave: "apariencia", icono: "🖌️", titulo: "Apariencia", subtitulo: "Modo claro u oscuro y colores de la app", panel: () => <AparienciaConfig /> },
    ],
  },
  {
    titulo: "Equipo y datos",
    opciones: [
      { clave: "equipo", icono: "👥", titulo: "Equipo", subtitulo: "Invitá al equipo y asigná roles", panel: () => <EquipoConfig /> },
      { clave: "auditoria", icono: "🔍", titulo: "Auditoría", subtitulo: "Quién cambió qué y cuándo, con el antes y el después", panel: () => <AuditoriaConfig /> },
      { clave: "exportar", icono: "📥", titulo: "Exportar mis datos", subtitulo: "Descargá tu historial. Tus datos son tuyos, siempre.", panel: () => <ExportarConfig /> },
    ],
  },
];
const OPCIONES = GRUPOS.flatMap((g) => g.opciones);

/**
 * Configuración en una sola pantalla: menú por temas a la izquierda y la opción elegida a la derecha.
 * En el celular es lista → detalle (con "volver").
 */
export function ConfiguracionVista() {
  const router = useRouter();
  const s = useSearchParams().get("s");
  const pedida = OPCIONES.find((o) => o.clave === s);
  const actual = pedida ?? OPCIONES[0];
  const { data: config, isPending, isError, error, refetch } = useConfiguracion();
  if (isPending) return <CargandoFilas filas={8} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;
  const ir = (clave: string | null) => router.replace(clave ? `/configuracion?s=${clave}` : "/configuracion", { scroll: false });

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label="Opciones de configuración" className={cn("flex flex-col gap-3 lg:sticky lg:top-4", pedida && "max-lg:hidden")}>
        {GRUPOS.map((g) => (
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
        <div className="p-4">{actual.panel(config)}</div>
      </section>
    </div>
  );
}
