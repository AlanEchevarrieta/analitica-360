import type { ExecutionContext } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LimitePedidosGuard } from './limite-pedidos.guard.js';

function contexto(req: Record<string, unknown>) {
  const res = { setHeader: vi.fn() };
  return {
    ctx: { getType: () => 'http', switchToHttp: () => ({ getRequest: () => ({ headers: {}, ...req }), getResponse: () => res }) } as unknown as ExecutionContext,
    res,
  };
}

describe('LimitePedidosGuard', () => {
  let vitest: string | undefined;
  beforeEach(() => {
    // El guard no actúa en las pruebas (para no frenar las e2e): acá sí.
    vitest = process.env.VITEST;
    delete process.env.VITEST;
    vi.useFakeTimers();
  });
  afterEach(() => {
    process.env.VITEST = vitest;
    vi.useRealTimers();
  });

  it('600 por minuto por IP; el 601 recibe 429 con Retry-After; al minuto siguiente vuelve', () => {
    const g = new LimitePedidosGuard();
    const { ctx, res } = contexto({ method: 'GET', path: '/productos', ip: '1.1.1.1' });
    for (let i = 0; i < 600; i++) expect(g.canActivate(ctx)).toBe(true);
    expect(() => g.canActivate(ctx)).toThrow(/Demasiados pedidos/);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    // Otra IP no se ve afectada.
    expect(g.canActivate(contexto({ method: 'GET', path: '/productos', ip: '2.2.2.2' }).ctx)).toBe(true);
    vi.advanceTimersByTime(60_001);
    expect(g.canActivate(ctx)).toBe(true);
  });

  it('las métricas de uso tienen su propio límite, más bajo', () => {
    const g = new LimitePedidosGuard();
    const { ctx } = contexto({ method: 'POST', path: '/uso/eventos', route: { path: '/uso/eventos' }, ip: '3.3.3.3' });
    for (let i = 0; i < 60; i++) g.canActivate(ctx);
    expect(() => g.canActivate(ctx)).toThrow();
    // El resto de la API sigue andando para esa IP.
    expect(g.canActivate(contexto({ method: 'GET', path: '/productos', ip: '3.3.3.3' }).ctx)).toBe(true);
  });

  it('detrás de una tienda con su clave cuenta la IP del comprador; sin la clave, el header no vale', () => {
    process.env.TIENDA_PROXY_KEY = 'clave-de-la-tienda-123';
    const g = new LimitePedidosGuard();
    const desde = (cliente: string, clave?: string) =>
      contexto({ method: 'GET', path: '/tienda/x/catalogo', ip: '10.0.0.5', headers: { 'x-forwarded-for': cliente, ...(clave ? { 'x-tienda-key': clave } : {}) } }).ctx;
    for (let i = 0; i < 600; i++) g.canActivate(desde('9.9.9.9', 'clave-de-la-tienda-123'));
    expect(() => g.canActivate(desde('9.9.9.9', 'clave-de-la-tienda-123'))).toThrow();
    // Otro comprador por la misma tienda: no está frenado.
    expect(g.canActivate(desde('8.8.8.8', 'clave-de-la-tienda-123'))).toBe(true);
    // Sin la clave, se cuenta la IP de quien llama (no se puede falsificar el header para esquivar el límite).
    for (let i = 0; i < 600; i++) g.canActivate(desde(`7.7.7.${i % 250}`));
    expect(() => g.canActivate(desde('6.6.6.6'))).toThrow();
    delete process.env.TIENDA_PROXY_KEY;
  });
});
