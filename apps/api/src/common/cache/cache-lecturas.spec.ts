import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheLecturasService } from './cache-lecturas.js';

describe('CacheLecturasService', () => {
  let cache: CacheLecturasService;
  beforeEach(() => {
    process.env.CACHE_LECTURAS = '1';
    cache = new CacheLecturasService();
  });
  afterEach(() => {
    delete process.env.CACHE_LECTURAS;
    vi.useRealTimers();
  });

  it('la segunda lectura igual no recalcula; pedidos simultáneos comparten el cálculo', async () => {
    const calcular = vi.fn(async () => ({ total: 1 }));
    const [a, b] = await Promise.all([cache.obtener('e1', '/x', calcular), cache.obtener('e1', '/x', calcular)]);
    await cache.obtener('e1', '/x', calcular);
    expect(a).toEqual({ total: 1 });
    expect(b).toBe(a);
    expect(calcular).toHaveBeenCalledTimes(1);
  });

  it('una escritura de la empresa la invalida; la de otra empresa no', async () => {
    const calcular = vi.fn(async () => 1);
    await cache.obtener('e1', '/x', calcular);
    await cache.obtener('e2', '/x', calcular);
    cache.invalidar('e2');
    await cache.obtener('e1', '/x', calcular);
    expect(calcular).toHaveBeenCalledTimes(2);
    await cache.obtener('e2', '/x', calcular);
    expect(calcular).toHaveBeenCalledTimes(3);
  });

  it('una escritura sin empresa (tienda, consola) invalida todo', async () => {
    const calcular = vi.fn(async () => 1);
    await cache.obtener('e1', '/x', calcular);
    cache.invalidar(null);
    await cache.obtener('e1', '/x', calcular);
    expect(calcular).toHaveBeenCalledTimes(2);
  });

  it('un cálculo que terminó después de una escritura no queda guardado', async () => {
    let soltar!: (v: number) => void;
    const lento = () => new Promise<number>((r) => (soltar = r));
    const pendiente = cache.obtener('e1', '/x', lento);
    cache.invalidar('e1');
    soltar(1);
    await pendiente;
    const calcular = vi.fn(async () => 2);
    expect(await cache.obtener('e1', '/x', calcular)).toBe(2);
    expect(calcular).toHaveBeenCalledTimes(1);
  });

  it('los errores no se guardan', async () => {
    await expect(cache.obtener('e1', '/x', () => Promise.reject(new Error('falló')))).rejects.toThrow('falló');
    await new Promise((r) => setTimeout(r, 0));
    expect(await cache.obtener('e1', '/x', async () => 3)).toBe(3);
  });

  it('vence a los 5 minutos aunque nadie escriba', async () => {
    vi.useFakeTimers();
    const calcular = vi.fn(async () => 1);
    await cache.obtener('e1', '/x', calcular);
    vi.advanceTimersByTime(5 * 60_000 + 1);
    await cache.obtener('e1', '/x', calcular);
    expect(calcular).toHaveBeenCalledTimes(2);
  });

  it('en las pruebas está apagada salvo que se pida', async () => {
    delete process.env.CACHE_LECTURAS;
    const calcular = vi.fn(async () => 1);
    await cache.obtener('e1', '/x', calcular);
    await cache.obtener('e1', '/x', calcular);
    expect(calcular).toHaveBeenCalledTimes(2);
  });
});
