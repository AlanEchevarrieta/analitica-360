import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { EXPORTACION_KEY, PERMITIDO_SIN_SUSCRIPCION_KEY } from '../decorators/suscripcion.decorator.js';
import type { AccesoCuenta } from '../../modules/planes/acceso-cuenta.util.js';
import type { AccesoCuentaService } from '../../modules/planes/acceso-cuenta.service.js';
import { SuscripcionGuard } from './suscripcion.guard.js';

const ACTIVO: AccesoCuenta = { nivel: 'activo', motivo: null, puedeExportar: true, bloqueoDesde: null };
const GRACIA: AccesoCuenta = { nivel: 'gracia', motivo: 'plan_vencido', puedeExportar: true, bloqueoDesde: '2026-11-09' };
const PRUEBA_VENCIDA: AccesoCuenta = { nivel: 'solo_lectura', motivo: 'prueba_vencida', puedeExportar: false, bloqueoDesde: null };
const PLAN_VENCIDO: AccesoCuenta = { nivel: 'solo_lectura', motivo: 'plan_vencido', puedeExportar: true, bloqueoDesde: null };

function armar(acceso: AccesoCuenta, metadata: Record<string, boolean> = {}) {
  const reflector = { getAllAndOverride: vi.fn((key: string) => metadata[key]) } as unknown as Reflector;
  const servicio = { de: vi.fn().mockResolvedValue(acceso) } as unknown as AccesoCuentaService;
  return { guard: new SuscripcionGuard(reflector, servicio), servicio };
}

function contexto(method: string, conEmpresa = true): ExecutionContext {
  const request = { method, empresa: conEmpresa ? { id: 'e1' } : undefined };
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

async function codigo(promesa: Promise<boolean>) {
  try {
    await promesa;
    return 'ok';
  } catch (e) {
    expect(e).toBeInstanceOf(ForbiddenException);
    return ((e as ForbiddenException).getResponse() as { code: string }).code;
  }
}

describe('SuscripcionGuard', () => {
  it('cuenta activa o en gracia: deja cargar', async () => {
    expect(await armar(ACTIVO).guard.canActivate(contexto('POST'))).toBe(true);
    expect(await armar(GRACIA).guard.canActivate(contexto('POST'))).toBe(true);
  });

  it('solo lectura: deja consultar y rechaza cargar', async () => {
    const { guard } = armar(PRUEBA_VENCIDA);
    expect(await guard.canActivate(contexto('GET'))).toBe(true);
    expect(await codigo(guard.canActivate(contexto('POST')))).toBe('cuenta_solo_lectura');
    expect(await codigo(guard.canActivate(contexto('PATCH')))).toBe('cuenta_solo_lectura');
    expect(await codigo(guard.canActivate(contexto('DELETE')))).toBe('cuenta_solo_lectura');
  });

  it('exportar: no con la prueba vencida, sí con un plan pago vencido', async () => {
    expect(await codigo(armar(PRUEBA_VENCIDA, { [EXPORTACION_KEY]: true }).guard.canActivate(contexto('GET')))).toBe('cuenta_sin_exportacion');
    expect(await armar(PLAN_VENCIDO, { [EXPORTACION_KEY]: true }).guard.canActivate(contexto('GET'))).toBe(true);
  });

  it('Planes/Soporte (@PermitidoSinSuscripcion), rutas públicas y registro sin empresa pasan sin consultar', async () => {
    const casos: Record<string, boolean>[] = [{ [PERMITIDO_SIN_SUSCRIPCION_KEY]: true }, { [IS_PUBLIC_KEY]: true }];
    for (const meta of casos) {
      const { guard, servicio } = armar(PRUEBA_VENCIDA, meta);
      expect(await guard.canActivate(contexto('POST'))).toBe(true);
      expect(servicio.de).not.toHaveBeenCalled();
    }
    expect(await armar(PRUEBA_VENCIDA).guard.canActivate(contexto('POST', false))).toBe(true);
  });
});
