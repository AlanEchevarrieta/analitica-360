export interface ItemMercadoScrapeado {
  titulo: string;
  precio: number;
  moneda: string;
  vendedor: string;
  url: string;
  fuente: 'mercadolibre' | 'tienda_competidor' | 'google';
  reputacionVendedor?: string;
  stock?: number;
  condicion?: string;
  foto?: string;
}

export type EstadoCompetitivo = 'alineado' | 'barato_margen_recuperable' | 'caro_fuera_de_mercado';

export interface MetricasMercado {
  precioMinimo: number;
  precioMediana: number;
  precioPromedio: number;
  precioMaximo: number;
  muestraTotal: number;
  muestraFiltrada: number;
  brechaPorcentaje: number;
  estadoCompetitivo: EstadoCompetitivo;
  items: ItemMercadoScrapeado[];
}

export interface ResultadoBenchmarkProducto {
  productoId: string;
  nombre: string;
  codigoBarra: string | null;
  sku: string | null;
  precioLocal: number;
  costoLocal: number | null;
  metricas: MetricasMercado;
  fechaEscaneo: string;
  fuentePrincipal: string;
  urlBusquedaMercado: string;
}

export interface EscaneoLoteInput {
  limite?: number;
  categoriaId?: string;
  soloConCodigoBarra?: boolean;
}

export interface AlinearPrecioInput {
  nuevoPrecio: number;
  motivo?: string;
}
