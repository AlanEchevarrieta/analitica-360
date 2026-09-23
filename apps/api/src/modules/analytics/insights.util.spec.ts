import {
  armarForecast,
  armarVariantes,
  calcularElasticidades,
  calcularSalud,
  etiquetaCombo,
  inicioMesHace,
  mesAnteriorDe,
  preciosOptimos,
  type FilaElasticidad,
  type InsightProducto,
  type ItemInsight,
  type VentaInsight,
} from './insights.util.js';

describe('mesAnteriorDe / inicioMesHace', () => {
  it('retrocede un mes calendario', () => {
    expect(mesAnteriorDe('2026-09-01')).toBe('2026-08-01');
    expect(mesAnteriorDe('2026-01-01')).toBe('2025-12-01');
  });

  it('retrocede N meses desde el inicio del mes de la fecha dada', () => {
    expect(inicioMesHace('2026-09-22', 5)).toBe('2026-04-01');
  });
});

describe('etiquetaCombo', () => {
  it('ordena atributos alfabéticamente y los une con /', () => {
    expect(etiquetaCombo({ Talle: 'M', Color: 'Rojo' })).toBe('Rojo/M');
  });
});

describe('calcularSalud', () => {
  const productos: InsightProducto[] = [
    { id: 'p1', nombre: 'A', costo: 50, precioVenta: 100, activo: true, stockActual: 10 },
    { id: 'p2', nombre: 'B', costo: 80, precioVenta: 100, activo: true, stockActual: 0 },
  ];
  const ventas: VentaInsight[] = [
    { id: 'v1', fechaIso: '2026-09-10', clienteId: 'c1', total: 100 },
    { id: 'v2', fechaIso: '2026-09-11', clienteId: null, total: 50 },
  ];

  it('score sube cuando las ventas del mes superan al mes anterior', () => {
    const res = calcularSalud({ ventasMes: 200, ventasMesAnt: 100, hayMesAnterior: true, productos, ventas, elasticidades: [] });
    const ventasEje = res.ejes.find((e) => e.eje === 'Ventas')!;
    expect(ventasEje.valor).toBe(100);
  });

  it('sin mes anterior usa 50 como eje neutro de ventas', () => {
    const res = calcularSalud({ ventasMes: 200, ventasMesAnt: 0, hayMesAnterior: false, productos, ventas, elasticidades: [] });
    expect(res.ejes.find((e) => e.eje === 'Ventas')!.valor).toBe(50);
  });
});

describe('calcularElasticidades', () => {
  it('detecta una elasticidad negativa cuando sube el precio y bajan las unidades', () => {
    const productos: InsightProducto[] = [{ id: 'p1', nombre: 'Yerba', costo: 50, precioVenta: 120, activo: true, stockActual: 5 }];
    const historial = [
      { productoId: 'p1', precio: 100, desde: '2026-07-01' },
      { productoId: 'p1', precio: 120, desde: '2026-08-15' },
    ];
    const ventas: VentaInsight[] = [
      { id: 'v1', fechaIso: '2026-07-10', clienteId: null, total: 100 },
      { id: 'v2', fechaIso: '2026-08-20', clienteId: null, total: 120 },
    ];
    const items: ItemInsight[] = [
      { ventaId: 'v1', productoId: 'p1', varianteId: null, cantidad: 10 },
      { ventaId: 'v2', productoId: 'p1', varianteId: null, cantidad: 4 },
    ];
    const res = calcularElasticidades(productos, historial, ventas, items, '2026-09-22');
    expect(res).toHaveLength(1);
    expect(res[0].elasticidad).toBeLessThan(0);
    expect(res[0].badge).not.toBe('giffen');
  });

  it('ignora productos con un solo precio en el historial', () => {
    const productos: InsightProducto[] = [{ id: 'p1', nombre: 'X', costo: 1, precioVenta: 1, activo: true, stockActual: 0 }];
    const historial = [{ productoId: 'p1', precio: 100, desde: '2026-07-01' }];
    const res = calcularElasticidades(productos, historial, [], [], '2026-09-22');
    expect(res).toEqual([]);
  });
});

describe('armarForecast', () => {
  it('devuelve null con menos de 2 puntos útiles', () => {
    expect(armarForecast([{ fecha: '2026-09-01', total: 100 }], 'dia', 30)).toBeNull();
  });

  it('proyecta una tendencia positiva cuando la serie crece de forma sostenida', () => {
    const serie = Array.from({ length: 10 }, (_, i) => ({ fecha: `2026-09-${String(i + 1).padStart(2, '0')}`, total: 100 + i * 20 }));
    const res = armarForecast(serie, 'dia', 40);
    expect(res).not.toBeNull();
    expect(res!.tendencia).toBe('positiva');
    expect(res!.totalProyeccion).toBeGreaterThan(0);
    expect(res!.puntos.some((p) => p.proyeccion != null && p.historico == null)).toBe(true);
  });
});

describe('preciosOptimos', () => {
  it('sugiere un precio mayor solo para elasticidades negativas con costo positivo', () => {
    const productos: InsightProducto[] = [{ id: 'p1', nombre: 'Yerba', costo: 60, precioVenta: 100, activo: true, stockActual: 5 }];
    const elasticidades: FilaElasticidad[] = [
      {
        productoId: 'p1',
        producto: 'Yerba',
        precioAnterior: 80,
        precioActual: 100,
        deltaPrecioPct: 25,
        deltaVentasPct: -50,
        // La fórmula de Amoroso-Robinson (opt = costo / (1 + 1/elasticidad)) solo da un
        // precio óptimo finito y positivo cuando la demanda es elástica (elasticidad < -1).
        elasticidad: -2,
        badge: 'elastica',
        recomendacion: '',
      },
    ];
    const ventas: VentaInsight[] = [{ id: 'v1', fechaIso: '2026-09-05', clienteId: null, total: 100 }];
    const items: ItemInsight[] = [{ ventaId: 'v1', productoId: 'p1', varianteId: null, cantidad: 3 }];
    const res = preciosOptimos(productos, elasticidades, items, ventas, '2026-09-01');
    expect(res).toHaveLength(1);
    expect(res[0].precioSugerido).toBeGreaterThan(res[0].precioActual);
    expect(res[0].extraMes).toBeCloseTo((res[0].precioSugerido - 100) * 3);
  });
});

describe('armarVariantes', () => {
  it('hayVentas es false si ningún ítem tiene varianteId', () => {
    const res = armarVariantes([{ ventaId: 'v1', productoId: 'p1', varianteId: null, cantidad: 1 }], [], [], new Map(), '2026-09-22');
    expect(res.hayVentas).toBe(false);
  });

  it('agrupa unidades por atributo y arma combinaciones', () => {
    const items: ItemInsight[] = [
      { ventaId: 'v1', productoId: 'p1', varianteId: 'var-rojo-m', cantidad: 5 },
      { ventaId: 'v2', productoId: 'p1', varianteId: 'var-azul-m', cantidad: 2 },
    ];
    const ventas: VentaInsight[] = [
      { id: 'v1', fechaIso: '2026-09-10', clienteId: null, total: 100 },
      { id: 'v2', fechaIso: '2026-09-11', clienteId: null, total: 40 },
    ];
    const variantes = [
      { id: 'var-rojo-m', productoId: 'p1', atributos: { Color: 'Rojo', Talle: 'M' } },
      { id: 'var-azul-m', productoId: 'p1', atributos: { Color: 'Azul', Talle: 'M' } },
    ];
    const res = armarVariantes(items, ventas, variantes, new Map(), '2026-09-22');
    expect(res.hayVentas).toBe(true);
    expect(res.combinaciones[0].etiqueta).toBe('Rojo/M');
    expect(res.combinaciones[0].pct).toBeCloseTo((5 / 7) * 100);
    const colorAttr = res.porAtributo.find((a) => a.atributo === 'Color')!;
    expect(colorAttr.valores.map((v) => v.name)).toEqual(['Rojo', 'Azul']);
  });
});
