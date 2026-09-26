import { categoriaPara, estadoMonotributo, proximaRecategorizacion, type TopeCategoria } from './monotributo.util.js';

const TOPES: TopeCategoria[] = [
  { categoria: 'A', topeAnual: 7_000_000 },
  { categoria: 'B', topeAnual: 11_000_000 },
  { categoria: 'C', topeAnual: 16_000_000 },
  { categoria: 'K', topeAnual: 82_000_000 },
];
const base = { ingresosUltimos3Meses: 2_400_000, topes: TOPES, vigenciaTopes: '2026-08-01', hoy: '2026-09-26' };

describe('monotributo', () => {
  it('categoría según ingresos', () => {
    expect(categoriaPara(5_000_000, TOPES)).toBe('A');
    expect(categoriaPara(7_000_000, TOPES)).toBe('A');
    expect(categoriaPara(7_000_001, TOPES)).toBe('B');
    expect(categoriaPara(90_000_000, TOPES)).toBeNull();
  });

  it('próxima recategorización', () => {
    expect(proximaRecategorizacion('2026-09-26')).toEqual({ mes: '2027-01', desde: '2026-01-01', hasta: '2026-12-31' });
    expect(proximaRecategorizacion('2026-03-10')).toEqual({ mes: '2026-07', desde: '2025-07-01', hasta: '2026-06-30' });
  });

  it('cómodo en su categoría: sin alertas', () => {
    const e = estadoMonotributo({ ...base, ingresos12m: 8_000_000, categoriaActual: 'B' });
    expect(e.alertas).toEqual([]);
    expect(e.usoPct).toBe(72.7);
    expect(e.margenDisponible).toBe(3_000_000);
    expect(e.ritmoMensual).toBe(800_000);
    expect(e.proyeccionAnual).toBe(9_600_000);
    expect(e.categoriaProyectada).toBe('B');
  });

  it('cerca del tope (80% o más)', () => {
    expect(estadoMonotributo({ ...base, ingresos12m: 9_000_000, categoriaActual: 'B' }).alertas).toEqual(['cerca_tope']);
  });

  it('ya supera su categoría: corresponde subir', () => {
    const e = estadoMonotributo({ ...base, ingresos12m: 12_000_000, categoriaActual: 'B' });
    expect(e.alertas).toEqual(['supera_categoria']);
    expect(e.categoriaSegunIngresos).toBe('C');
  });

  it('supera la categoría más alta: riesgo de exclusión', () => {
    expect(estadoMonotributo({ ...base, ingresos12m: 90_000_000, categoriaActual: 'K' }).alertas).toEqual(['exclusion']);
  });

  it('podría bajar de categoría', () => {
    expect(estadoMonotributo({ ...base, ingresos12m: 3_000_000, categoriaActual: 'C' }).alertas).toEqual(['puede_bajar']);
  });

  it('sin categoría cargada y topes viejos', () => {
    const e = estadoMonotributo({ ...base, ingresos12m: 3_000_000, categoriaActual: null, vigenciaTopes: '2025-02-01' });
    expect(e.alertas).toEqual(['sin_categoria', 'topes_desactualizados']);
    expect(e.usoPct).toBeNull();
  });
});
