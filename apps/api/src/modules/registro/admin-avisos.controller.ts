import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { RequireAdminApp } from '../../common/decorators/admin-app.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PrismaService } from '../../database/prisma.service.js';

const marcarSchema = z.object({ ids: z.array(z.uuid()).optional() });

/** Avisos de la consola (registros nuevos): los últimos 30 y cuántos sin ver. */
@Controller('admin/avisos')
@RequireAdminApp()
export class AdminAvisosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listar() {
    const [avisos, sinLeer] = await Promise.all([
      this.prisma.avisoAdmin.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
      this.prisma.avisoAdmin.count({ where: { leido: false } }),
    ]);
    return { sinLeer, avisos };
  }

  /** Sin ids marca todos como vistos. */
  @Post('leidos')
  @HttpCode(200)
  async marcar(@Body(new ZodValidationPipe(marcarSchema)) body: z.infer<typeof marcarSchema>) {
    await this.prisma.avisoAdmin.updateMany({ where: { leido: false, ...(body.ids ? { id: { in: body.ids } } : {}) }, data: { leido: true } });
    return { ok: true };
  }
}
