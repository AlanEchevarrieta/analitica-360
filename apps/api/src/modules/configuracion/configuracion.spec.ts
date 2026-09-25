import { actualizarConfiguracionSchema } from './configuracion.dto.js';
import { aRecord } from './prisma-configuracion.repository.js';

describe('aRecord', () => {
  it('sin fila devuelve defaults usables (medios, cuotas, umbral 5)', () => {
    const c = aRecord(null);
    expect(c.mediosPago).toContain('efectivo');
    expect(c.tasasCuotas.length).toBeGreaterThan(0);
    expect(c.umbralStockBajo).toBe(5);
    expect(c.mostrarCliente).toBe('opcional');
  });
});

describe('actualizarConfiguracionSchema', () => {
  it('rechaza dos planes con la misma cantidad de cuotas', () => {
    const r = actualizarConfiguracionSchema.safeParse({
      tasasCuotas: [
        { cuotas: 3, tasa: 0, label: '3', activo: true },
        { cuotas: 3, tasa: 10, label: '3 bis', activo: true },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('rechaza dejar sin medios de pago', () => {
    expect(actualizarConfiguracionSchema.safeParse({ mediosPago: [] }).success).toBe(false);
  });

  it('acepta un PATCH parcial', () => {
    expect(actualizarConfiguracionSchema.safeParse({ umbralStockBajo: 3 }).success).toBe(true);
  });
});
