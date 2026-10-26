import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RadarPreciosService } from './radar-precios.service.js';
import type { ItemMercadoScrapeado } from './radar-precios.types.js';

describe('RadarPreciosService - Algoritmo Estadístico IQR y Benchmarking', () => {
  let service: RadarPreciosService;

  beforeEach(() => {
    const mockPrisma: any = {};
    const mockLake: any = { ingestarEvento: vi.fn() };
    service = new RadarPreciosService(mockPrisma, mockLake);
  });

  it('debe devolver métricas por defecto si no hay items encontrados', () => {
    const metricas = service.calcularMetricasConFiltroIQR(10000, []);
    expect(metricas.muestraTotal).toBe(0);
    expect(metricas.precioMediana).toBe(10000);
    expect(metricas.brechaPorcentaje).toBe(0);
    expect(metricas.estadoCompetitivo).toBe('alineado');
  });

  it('debe calcular correctamente la mediana y el promedio para precios homogéneos', () => {
    const items: ItemMercadoScrapeado[] = [
      { titulo: 'Prod A', precio: 10000, moneda: 'ARS', vendedor: 'V1', url: 'u1', fuente: 'mercadolibre' },
      { titulo: 'Prod B', precio: 10500, moneda: 'ARS', vendedor: 'V2', url: 'u2', fuente: 'mercadolibre' },
      { titulo: 'Prod C', precio: 11000, moneda: 'ARS', vendedor: 'V3', url: 'u3', fuente: 'mercadolibre' },
      { titulo: 'Prod D', precio: 11500, moneda: 'ARS', vendedor: 'V4', url: 'u4', fuente: 'mercadolibre' },
    ];

    const metricas = service.calcularMetricasConFiltroIQR(10750, items);
    expect(metricas.precioMinimo).toBe(10000);
    expect(metricas.precioMaximo).toBe(11500);
    expect(metricas.precioMediana).toBe(10750);
    expect(metricas.estadoCompetitivo).toBe('alineado');
    expect(metricas.brechaPorcentaje).toBe(0);
  });

  it('debe descartar outliers extremos (accesorios baratos o combos masivos) usando IQR', () => {
    const items: ItemMercadoScrapeado[] = [
      // Outlier bajo: funda/accesorio de $1.000
      { titulo: 'Funda o Accesorio', precio: 1000, moneda: 'ARS', vendedor: 'V0', url: 'u0', fuente: 'mercadolibre' },
      // Grupo real de mercado (~$20.000)
      { titulo: 'Producto Original A', precio: 19500, moneda: 'ARS', vendedor: 'V1', url: 'u1', fuente: 'mercadolibre' },
      { titulo: 'Producto Original B', precio: 20000, moneda: 'ARS', vendedor: 'V2', url: 'u2', fuente: 'mercadolibre' },
      { titulo: 'Producto Original C', precio: 20500, moneda: 'ARS', vendedor: 'V3', url: 'u3', fuente: 'mercadolibre' },
      { titulo: 'Producto Original D', precio: 21000, moneda: 'ARS', vendedor: 'V4', url: 'u4', fuente: 'mercadolibre' },
      // Outlier alto: combo de 10 unidades a $180.000
      { titulo: 'Combo 10x', precio: 180000, moneda: 'ARS', vendedor: 'V5', url: 'u5', fuente: 'mercadolibre' },
    ];

    const metricas = service.calcularMetricasConFiltroIQR(20000, items);
    // Debe descartar el de $1.000 y el de $180.000
    expect(metricas.precioMinimo).toBe(19500);
    expect(metricas.precioMaximo).toBe(21000);
    expect(metricas.precioMediana).toBe(20250);
    expect(metricas.muestraFiltrada).toBe(4);
    expect(metricas.estadoCompetitivo).toBe('alineado');
  });

  it('debe clasificar como "barato_margen_recuperable" si el precio local es 15% menor a la mediana', () => {
    const items: ItemMercadoScrapeado[] = [
      { titulo: 'Prod A', precio: 10000, moneda: 'ARS', vendedor: 'V1', url: 'u1', fuente: 'mercadolibre' },
      { titulo: 'Prod B', precio: 10000, moneda: 'ARS', vendedor: 'V2', url: 'u2', fuente: 'mercadolibre' },
    ];

    // Vendemos a $8.000 cuando en el mercado vale $10.000 (-20%)
    const metricas = service.calcularMetricasConFiltroIQR(8000, items);
    expect(metricas.brechaPorcentaje).toBe(-20);
    expect(metricas.estadoCompetitivo).toBe('barato_margen_recuperable');
  });

  it('debe clasificar como "caro_fuera_de_mercado" si el precio local es 20% mayor a la mediana', () => {
    const items: ItemMercadoScrapeado[] = [
      { titulo: 'Prod A', precio: 10000, moneda: 'ARS', vendedor: 'V1', url: 'u1', fuente: 'mercadolibre' },
      { titulo: 'Prod B', precio: 10000, moneda: 'ARS', vendedor: 'V2', url: 'u2', fuente: 'mercadolibre' },
    ];

    // Vendemos a $12.000 cuando en el mercado vale $10.000 (+20%)
    const metricas = service.calcularMetricasConFiltroIQR(12000, items);
    expect(metricas.brechaPorcentaje).toBe(20);
    expect(metricas.estadoCompetitivo).toBe('caro_fuera_de_mercado');
  });
});
