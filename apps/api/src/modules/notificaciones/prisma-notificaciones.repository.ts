import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { ConteoNotificaciones, NotificacionesRepository } from './notificaciones.repository.js';

@Injectable()
export class PrismaNotificacionesRepository implements NotificacionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async contar(empresaId: string): Promise<ConteoNotificaciones> {
    const hoy = new Date();
    const en30Dias = new Date(hoy.getTime() + 30 * 86_400_000);

    const [tickets, pedidos, lotesVencidos, lotesPorVencer] = await Promise.all([
      this.prisma.ticket.count({ where: { empresaId, estado: { in: ['abierto', 'en_proceso'] }, deletedAt: null } }),
      // Pedido no tiene deletedAt (no hay soft-delete, un pedido cancelado queda con estado 'cancelado').
      this.prisma.pedido.count({ where: { empresaId, estado: 'nuevo' } }),
      this.prisma.lote.count({ where: { empresaId, activo: true, fechaVencimiento: { lt: hoy } } }),
      this.prisma.lote.count({ where: { empresaId, activo: true, fechaVencimiento: { gte: hoy, lte: en30Dias } } }),
    ]);

    return { tickets, pedidos, lotesVencidos, lotesPorVencer };
  }
}
