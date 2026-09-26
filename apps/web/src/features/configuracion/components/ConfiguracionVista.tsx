"use client";

import { CargandoFilas, ErrorDatos } from "@/components/shared/estado-datos";
import { useConfiguracion } from "../hooks/use-configuracion";
import { AparienciaConfig } from "./AparienciaConfig";
import { EquipoConfig, ExportarConfig } from "./EquipoExportarConfig";
import { AtributosConfig, CategoriasConfig, UbicacionesConfig } from "./ListasConfig";
import { ListasPreciosConfig } from "./ListasPreciosConfig";
import { CuotasConfig, MediosConfig } from "./MediosCuotasConfig";
import { FlujoVentasConfig, InventarioPedidosConfig } from "./OperacionConfig";
import { FiscalConfig, RemitenteConfig } from "./RemitenteFiscalConfig";
import { Seccion } from "./Seccion";

export function ConfiguracionVista() {
  const { data: config, isPending, isError, error, refetch } = useConfiguracion();
  if (isPending) return <CargandoFilas filas={8} />;
  if (isError) return <ErrorDatos error={error} onReintentar={() => refetch()} />;

  return (
    <div className="flex max-w-4xl flex-col gap-3">
      <Seccion icono="💳" titulo="Medios de pago" subtitulo="Cómo aceptás pagos">
        <MediosConfig config={config} />
      </Seccion>
      <Seccion icono="📊" titulo="Cuotas y tasas" subtitulo="Intereses por cantidad de cuotas">
        <CuotasConfig config={config} />
      </Seccion>
      <Seccion icono="💸" titulo="Flujo de ventas" subtitulo="Qué se pide al cargar una venta">
        <FlujoVentasConfig config={config} />
      </Seccion>
      <Seccion icono="📦" titulo="Inventario y pedidos" subtitulo="Stock bajo, ubicación de venta y asignación de pedidos">
        <InventarioPedidosConfig config={config} />
      </Seccion>
      <Seccion icono="💲" titulo="Listas de precios" subtitulo="Mayorista, revendedor: precios distintos por cliente">
        <ListasPreciosConfig />
      </Seccion>
      <Seccion icono="📍" titulo="Ubicaciones" subtitulo="Depósitos, locales y stands">
        <UbicacionesConfig />
      </Seccion>
      <Seccion icono="🏷️" titulo="Categorías" subtitulo="Organizá tus productos">
        <CategoriasConfig />
      </Seccion>
      <Seccion icono="🎨" titulo="Variantes" subtitulo="Color, talle, material y más">
        <AtributosConfig />
      </Seccion>
      <Seccion icono="📬" titulo="Datos del remitente" subtitulo="Quién figura en el remito">
        <RemitenteConfig config={config} />
      </Seccion>
      <Seccion icono="🌎" titulo="Configuración fiscal" subtitulo="País, moneda e IVA">
        <FiscalConfig config={config} />
      </Seccion>
      <Seccion icono="🖌️" titulo="Apariencia" subtitulo="Modo claro u oscuro y colores de la app">
        <AparienciaConfig />
      </Seccion>
      <Seccion icono="👥" titulo="Equipo" subtitulo="Invitá al equipo y asigná roles">
        <EquipoConfig />
      </Seccion>
      <Seccion icono="📥" titulo="Exportar mis datos" subtitulo="Descargá tu historial. Tus datos son tuyos, siempre.">
        <ExportarConfig />
      </Seccion>
    </div>
  );
}
