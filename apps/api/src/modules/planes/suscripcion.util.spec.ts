import { diasRestantes, estaEnTrial, trialVencido } from './suscripcion.util.js';

describe('diasRestantes', () => {
  it('0 si no hay fecha de vencimiento', () => {
    expect(diasRestantes(null)).toBe(0);
  });

  it('0 (no negativo) si ya venció', () => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    expect(diasRestantes(ayer.toISOString().slice(0, 10))).toBe(0);
  });

  it('cuenta los días hacia adelante', () => {
    // Rango tolerante (4-6): setDate() usa hora local y toISOString() la
    // convierte a UTC, así que según el huso horario del entorno donde
    // corre el test la fecha resultante puede quedar un día antes o
    // después del "+5" nominal - no es parte del comportamiento a testear.
    const en5dias = new Date();
    en5dias.setDate(en5dias.getDate() + 5);
    const dias = diasRestantes(en5dias.toISOString().slice(0, 10));
    expect(dias).toBeGreaterThanOrEqual(4);
    expect(dias).toBeLessThanOrEqual(6);
  });
});

describe('estaEnTrial', () => {
  it('false si no hay suscripción', () => {
    expect(estaEnTrial(null)).toBe(false);
  });

  it('false si el estado no es periodo_prueba', () => {
    expect(estaEnTrial({ id: 's1', estado: 'activa', fechaVencimiento: '2099-01-01' })).toBe(false);
  });

  it('false si el trial ya venció, aunque el estado siga en periodo_prueba', () => {
    expect(estaEnTrial({ id: 's1', estado: 'periodo_prueba', fechaVencimiento: '2020-01-01' })).toBe(false);
  });

  it('true si está en periodo_prueba con días restantes', () => {
    expect(estaEnTrial({ id: 's1', estado: 'periodo_prueba', fechaVencimiento: '2099-01-01' })).toBe(true);
  });
});

describe('trialVencido', () => {
  it('false si no hay suscripción', () => {
    expect(trialVencido(null)).toBe(false);
  });

  it('true para estados terminales (vencida/pendiente_pago/cancelada), sin mirar la fecha', () => {
    expect(trialVencido({ id: 's1', estado: 'vencida', fechaVencimiento: '2099-01-01' })).toBe(true);
    expect(trialVencido({ id: 's1', estado: 'pendiente_pago', fechaVencimiento: null })).toBe(true);
    expect(trialVencido({ id: 's1', estado: 'cancelada', fechaVencimiento: null })).toBe(true);
  });

  it('periodo_prueba vencido cuenta como vencido, activo no', () => {
    expect(trialVencido({ id: 's1', estado: 'periodo_prueba', fechaVencimiento: '2020-01-01' })).toBe(true);
    expect(trialVencido({ id: 's1', estado: 'periodo_prueba', fechaVencimiento: '2099-01-01' })).toBe(false);
  });

  it('activa nunca cuenta como vencida', () => {
    expect(trialVencido({ id: 's1', estado: 'activa', fechaVencimiento: '2020-01-01' })).toBe(false);
  });
});
