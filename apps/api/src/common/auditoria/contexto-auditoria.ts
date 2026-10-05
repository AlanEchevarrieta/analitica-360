import { AsyncLocalStorage } from 'node:async_hooks';
import type { Accion, Cambios } from './auditoria.util.js';

export interface EventoAuditoria {
  empresaId: string | null;
  accion: Accion;
  entidad: string;
  entidadId: string | null;
  entidadNombre: string | null;
  resumen: string;
  cambios: Cambios | null;
}

/** Quién hace el pedido HTTP en curso, y lo que cambió (se guarda al terminar bien). */
export interface ContextoAuditoria {
  actorUsuarioId: string | null;
  actorEmpresaId: string | null;
  actorTipo: 'usuario' | 'admin' | 'tienda' | 'sistema';
  actorNombre: string;
  ip: string | null;
  ruta: string | null;
  eventos: EventoAuditoria[];
}

const almacen = new AsyncLocalStorage<ContextoAuditoria>();

export const contextoAuditoria = () => almacen.getStore();
export const conContextoAuditoria = <T>(ctx: ContextoAuditoria, fn: () => T): T => almacen.run(ctx, fn);
/**
 * Corre sin registrar en la bitácora. Solo para la baja de una cuenta: tapa los datos
 * personales y deja su propia constancia; si se registraran los cambios (ej. el nombre
 * viejo de la empresa), quedarían escritos después del tapado.
 */
export const sinContextoAuditoria = <T>(fn: () => T): T => almacen.exit(fn);
