import { alertasEmpresa } from './admin-clientes.util.js';
import type { AdminEmpresaFila } from './admin-clientes.types.js';

const base: AdminEmpresaFila = {
  id: 'e1',
  nombre: 'Acacia',
  esDemo: false,
  alta: '2026-06-01',
  baja: null,
  suscripcionId: 's1',
  plan: 'premium',
  precioPlan: 70000,
  estado: 'activa',
  vencimiento: '2026-12-31',
  usuarios: 2,
  productos: 30,
  ventas30: 100,
  monto30: 3_000_000,
  montoPrevio30: 3_200_000,
  ultimaVenta: '2026-09-24',
  ticketsAbiertos: 0,
  pagadoTotal: 0,
  ultimoPago: null,
};
const HOY = '2026-09-25';

describe('alertasEmpresa', () => {
  it('cliente sano: sin alertas', () => {
    expect(alertasEmpresa(base, HOY)).toEqual({ alertas: [], diasSinVender: 1 });
  });

  it('sin vender hace más de 14 días', () => {
    expect(alertasEmpresa({ ...base, ultimaVenta: '2026-09-01' }, HOY).alertas).toEqual(['sin_actividad']);
    expect(alertasEmpresa({ ...base, ultimaVenta: null }, HOY)).toEqual({ alertas: ['sin_actividad'], diasSinVender: null });
    // Registrado hace 2 días y sin ventas todavía: no es inactivo.
    expect(alertasEmpresa({ ...base, alta: '2026-09-24', ultimaVenta: null }, '2026-09-26').alertas).not.toContain('sin_actividad');
  });

  it('ventas que caen a menos de la mitad', () => {
    expect(alertasEmpresa({ ...base, monto30: 1_000_000 }, HOY).alertas).toEqual(['ventas_bajan']);
  });

  it('vencimientos', () => {
    expect(alertasEmpresa({ ...base, vencimiento: '2026-09-30' }, HOY).alertas).toEqual(['vence_pronto']);
    expect(alertasEmpresa({ ...base, vencimiento: '2026-09-20' }, HOY).alertas).toEqual(['vencida']);
    expect(alertasEmpresa({ ...base, estado: 'pendiente_pago' }, HOY).alertas).toEqual(['vencida']);
    expect(alertasEmpresa({ ...base, estado: 'periodo_prueba', vencimiento: '2026-09-27' }, HOY).alertas).toEqual(['prueba_termina']);
    expect(alertasEmpresa({ ...base, suscripcionId: null, estado: null, vencimiento: null }, HOY).alertas).toEqual(['sin_suscripcion']);
  });

  it('dado de baja: sin alertas', () => {
    expect(alertasEmpresa({ ...base, baja: '2026-09-14', ultimaVenta: null }, HOY).alertas).toEqual([]);
  });
});
