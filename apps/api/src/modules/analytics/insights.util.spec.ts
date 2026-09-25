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
    expect(res[0].badge).not.toBe('otros_factores');
  });

  it('descuenta la temporada: si todo el negocio vendió la mitad, no es efecto del precio', () => {
    const productos: InsightProducto[] = [
      { id: 'p1', nombre: 'Yerba', costo: 50, precioVenta: 120, activo: true, stockActual: 5 },
      { id: 'p2', nombre: 'Mate', costo: 50, precioVenta: 100, activo: true, stockActual: 5 },
    ];
    const historial = [
      { productoId: 'p1', precio: 100, desde: '2026-07-01' },
      { productoId: 'p1', precio: 120, desde: '2026-08-15' },
    ];
    const ventas: VentaInsight[] = [
      { id: 'v1', fechaIso: '2026-07-10', clienteId: null, total: 100 },
      { id: 'v2', fechaIso: '2026-08-20', clienteId: null, total: 120 },
    ];
    // El producto y el resto del negocio caen igual (50%): elasticidad ~0.
    const items: ItemInsight[] = [
      { ventaId: 'v1', productoId: 'p1', varianteId: null, cantidad: 10 },
      { ventaId: 'v1', productoId: 'p2', varianteId: null, cantidad: 20 },
      { ventaId: 'v2', productoId: 'p1', varianteId: null, cantidad: 5 },
      { ventaId: 'v2', productoId: 'p2', varianteId: null, cantidad: 10 },
    ];
    const res = calcularElasticidades(productos, historial, ventas, items, '2026-09-22');
    expect(res[0].elasticidad).toBeCloseTo(0, 5);
  });

  it('no estima con muy pocas unidades (ruido)', () => {
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
      { ventaId: 'v1', productoId: 'p1', varianteId: null, cantidad: 2 },
      { ventaId: 'v2', productoId: 'p1', varianteId: null, cantidad: 1 },
    ];
    expect(calcularElasticidades(productos, historial, ventas, items, '2026-09-22')).toHaveLength(0);
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

describe('armarForecast (semanal)', () => {
  const dia = (fecha: string, total: number) => ({ fecha, total });

  it('no usa la semana en curso y cuenta las semanas sin ventas como 0', () => {
    // Lunes 07/09, 14/09 (sin ventas), 21/09 y la semana en curso del 28/09.
    const serie = [dia('2026-09-07', 1000), dia('2026-09-21', 1000), dia('2026-09-28', 50)];
    const f = armarForecast(serie, 'semana', 60, '2026-09-29');
    const historicos = f!.puntos.filter((p) => p.historico != null).map((p) => [p.clave, p.historico]);
    expect(historicos).toEqual([
      ['2026-09-07', 1000],
      ['2026-09-14', 0],
      ['2026-09-21', 1000],
    ]);
  });

  it('una semana estable da tendencia neutra', () => {
    const serie = ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24'].map((d) => dia(d, 1000));
    expect(armarForecast(serie, 'semana', 60, '2026-09-29')!.tendencia).toBe('neutra');
  });
});
