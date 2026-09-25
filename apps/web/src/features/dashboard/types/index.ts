// Espejo de DashboardInicio (apps/api modules/analytics/dashboard.repository.ts).
export interface DashboardStockItem {
  nombre: string;
  stock: number;
}

export interface DashboardInicio {
  hoy: { cantidad: number; total: number };
  semana: number;
  mes: number;
  comprasMes: number;
  topHoy: { nombre: string; unidades: number } | null;
  ultimos7: { fecha: string; dia: string; total: number; cantidad?: number }[];
  top5: { nombre: string; unidades: number }[];
  stock: DashboardStockItem[];
  alertasStock: DashboardStockItem[];
  cumples: { id: string; nombre: string; dias: number }[];
}
