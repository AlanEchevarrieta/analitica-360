import { type CallHandler, type ExecutionContext, Injectable, Logger, type NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { concatMap, from, Observable } from 'rxjs';
import { PrismaService } from '../../database/prisma.service.js';
import { conContextoAuditoria, type ContextoAuditoria } from './contexto-auditoria.js';

const LECTURAS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Abre el contexto de auditoría en cada pedido que escribe y, si terminó
 * bien, guarda en la bitácora todo lo que cambió. Si el pedido falla no se
 * guarda nada: la transacción se deshizo y no hubo cambios.
 */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditoriaInterceptor.name);
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request>();
    if (LECTURAS.has(req.method)) return next.handle();

    const ruta = `${req.method} ${(req.route as { path?: string } | undefined)?.path ?? req.path}`.slice(0, 200);
    const u = req.usuario;
    const ctx: ContextoAuditoria = {
      actorUsuarioId: u?.id ?? null,
      actorEmpresaId: u?.empresaId ?? null,
      actorTipo: u ? (req.path.startsWith('/admin') ? 'admin' : 'usuario') : req.path.startsWith('/tienda') ? 'tienda' : 'sistema',
      actorNombre: u?.email ?? (req.path.startsWith('/tienda') ? 'Tienda online' : req.path.startsWith('/internal') ? 'Clerk' : 'Sistema'),
      ip: req.ip ? req.ip.replace(/^::ffff:/, '').slice(0, 64) : null,
      ruta,
      eventos: [],
    };
    return new Observable((sub) => {
      conContextoAuditoria(ctx, () =>
        next
          .handle()
          .pipe(concatMap((valor) => from(this.guardar(ctx).then(() => valor))))
          .subscribe(sub),
      );
    });
  }

  private async guardar(ctx: ContextoAuditoria) {
    // Anular una venta también la marca como borrada: alcanza con "anuló venta".
    const anuladas = new Set(ctx.eventos.filter((e) => e.accion === 'anular').map((e) => e.entidadId));
    const eventos = ctx.eventos.filter((e) => !(e.entidad === 'Venta' && e.accion === 'borrar' && anuladas.has(e.entidadId)));
    if (eventos.length === 0) return;
    try {
      // El nombre de la persona se ve mejor que el email.
      const nombre = ctx.actorUsuarioId ? (await this.prisma.usuario.findUnique({ where: { id: ctx.actorUsuarioId }, select: { nombre: true } }))?.nombre : null;
      await this.prisma.registroAuditoria.createMany({
        data: eventos.map((e) => ({
          ...e,
          cambios: (e.cambios ?? undefined) as Prisma.InputJsonValue | undefined,
          empresaId: e.empresaId ?? ctx.actorEmpresaId,
          actorUsuarioId: ctx.actorUsuarioId,
          actorEmpresaId: ctx.actorEmpresaId,
          actorTipo: ctx.actorTipo,
          actorNombre: (nombre?.trim() || ctx.actorNombre).slice(0, 160),
          entidadNombre: e.entidadNombre?.slice(0, 160) ?? null,
          ip: ctx.ip,
          ruta: ctx.ruta,
        })),
      });
    } catch (e) {
      // No se corta la respuesta: el cambio ya se hizo. Queda en el log para revisarlo.
      this.logger.error(`No se pudo guardar la bitácora (${ctx.ruta}, ${eventos.length} eventos): ${String(e)}`);
    }
  }
}
