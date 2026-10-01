import { describe, expect, it } from 'vitest';
import { accesoCuenta } from './acceso-cuenta.util.js';

const sub = (estado: string, fechaVencimiento: string | null) => ({ id: 's1', estado, fechaVencimiento });

describe('accesoCuenta', () => {
  it('prueba vigente: activo; el día del vencimiento ya está vencida (como estaEnTrial)', () => {
    expect(accesoCuenta(sub('periodo_prueba', '2026-10-15'), false, '2026-10-14').nivel).toBe('activo');
    expect(accesoCuenta(sub('periodo_prueba', '2026-10-15'), false, '2026-10-15')).toEqual({
      nivel: 'solo_lectura',
      motivo: 'prueba_vencida',
      puedeExportar: false,
      bloqueoDesde: null,
    });
  });

  it('plan pago: completo hasta el vencimiento inclusive, 7 días de gracia y después solo lectura con exportación', () => {
    const s = sub('activa', '2026-11-01');
    expect(accesoCuenta(s, false, '2026-11-01').nivel).toBe('activo');
    expect(accesoCuenta(s, false, '2026-11-02')).toEqual({ nivel: 'gracia', motivo: 'plan_vencido', puedeExportar: true, bloqueoDesde: '2026-11-09' });
    expect(accesoCuenta(s, false, '2026-11-08').nivel).toBe('gracia');
    expect(accesoCuenta(s, false, '2026-11-09')).toEqual({ nivel: 'solo_lectura', motivo: 'plan_vencido', puedeExportar: true, bloqueoDesde: null });
  });

  it('plan sin fecha de vencimiento: activo', () => {
    expect(accesoCuenta(sub('activa', null), false, '2030-01-01').nivel).toBe('activo');
  });

  it('estados que marca el admin (vencida, cancelada, pendiente de pago): solo lectura, puede exportar', () => {
    for (const estado of ['vencida', 'cancelada', 'pendiente_pago']) {
      expect(accesoCuenta(sub(estado, '2099-01-01'), false, '2026-10-01')).toMatchObject({ nivel: 'solo_lectura', puedeExportar: true });
    }
  });

  it('empresa demo o sin suscripción: nunca se bloquea', () => {
    expect(accesoCuenta(sub('periodo_prueba', '2020-01-01'), true, '2026-10-01').nivel).toBe('activo');
    expect(accesoCuenta(null, false, '2026-10-01').nivel).toBe('activo');
  });
});
