import { formatoNumeroTicket, tieneRespuestaAdminNoLeida } from './ticket.util.js';

describe('formatoNumeroTicket', () => {
  it('rellena con ceros a la izquierda hasta 6 dígitos', () => {
    expect(formatoNumeroTicket(1n)).toBe('T-000001');
    expect(formatoNumeroTicket(42n)).toBe('T-000042');
  });

  it('no trunca si el número ya tiene más de 6 dígitos', () => {
    expect(formatoNumeroTicket(1234567n)).toBe('T-1234567');
  });
});

describe('tieneRespuestaAdminNoLeida', () => {
  it('false si nunca respondió un admin', () => {
    expect(tieneRespuestaAdminNoLeida(null, [{ esAdmin: false, createdAt: new Date('2026-09-01') }])).toBe(false);
  });

  it('true si hay respuesta de admin y el cliente nunca vio el ticket', () => {
    expect(tieneRespuestaAdminNoLeida(null, [{ esAdmin: true, createdAt: new Date('2026-09-01') }])).toBe(true);
  });

  it('true solo si la última respuesta de admin es más nueva que la última vista del cliente', () => {
    const visto = new Date('2026-09-05');
    expect(tieneRespuestaAdminNoLeida(visto, [{ esAdmin: true, createdAt: new Date('2026-09-01') }])).toBe(false);
    expect(tieneRespuestaAdminNoLeida(visto, [{ esAdmin: true, createdAt: new Date('2026-09-10') }])).toBe(true);
  });

  it('toma la respuesta de admin MÁS RECIENTE, no la primera', () => {
    const visto = new Date('2026-09-05');
    const respuestas = [
      { esAdmin: true, createdAt: new Date('2026-09-01') },
      { esAdmin: true, createdAt: new Date('2026-09-10') },
      { esAdmin: false, createdAt: new Date('2026-09-12') },
    ];
    expect(tieneRespuestaAdminNoLeida(visto, respuestas)).toBe(true);
  });
});
