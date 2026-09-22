export interface DashboardHoy {
  cantidad: number;
  total: number;
}

export interface DashboardDiaSerie {
  fecha: string;
  dia: string;
  total: number;
  cantidad?: number;
}

export interface DashboardTopProducto {
  nombre: string;
  unidades: number;
}

export interface DashboardStockItem {
  nombre: string;
  stock: number;
}

export interface DashboardCumple {
  id: string;
  nombre: string;
  dias: number;
}

/** Todo lo que resuelve directo de Ventas/Compras/Productos - los cumpleaños se arman en el service (reusa ClientesService, no duplica esa lógica acá). */
export interface DashboardInicioBase {
  hoy: DashboardHoy;
  semana: number;
  mes: number;
  comprasMes: number;
  topHoy: DashboardTopProducto | null;
  ultimos7: DashboardDiaSerie[];
  top5: DashboardTopProducto[];
  stock: DashboardStockItem[];
  alertasStock: DashboardStockItem[];
}

export interface DashboardInicio extends DashboardInicioBase {
  cumples: DashboardCumple[];
}

export type RangoHome = 7 | 30 | 90;

export const DASHBOARD_REPOSITORY = Symbol('DASHBOARD_REPOSITORY');

/**
 * Puerto de lectura del dashboard de inicio. Implementación real:
 * PrismaDashboardRepository - puerto fiel de la función SQL
 * public.dashboard_inicio() (supabase/026_inventario_alertas.sql, la
 * última definición - se redefinió 5 veces a lo largo del legacy: 012,
 * 013, 016, 020, 026). A diferencia de otras funciones RPC del legacy que
 * había que inferir por el contexto, para esta SÍ se pudo leer el SQL
 * real y portar la lógica 1:1 en vez de adivinarla.
 */
export interface DashboardRepository {
  inicio(empresaId: string): Promise<DashboardInicioBase>;
  /** Serie diaria de ventas de los últimos `dias` (7/30/90), sin RPC en el legacy - consulta directa. */
  serieHome(empresaId: string, dias: RangoHome): Promise<DashboardDiaSerie[]>;
}
