import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { PLANTILLAS_EJEMPLO, type TipoAprobacion } from './proyectos.util.js';

export interface PlantillaEtapaInput {
  nombre: string;
  diasObjetivo?: number | null;
  aprobacion?: TipoAprobacion;
  aprobadorInternoId?: string | null;
}

export interface PlantillaProyectoInput {
  nombre: string;
  descripcion?: string | null;
  orden?: number;
  etapas: PlantillaEtapaInput[];
}

@Injectable()
export class PlantillasProyectoService {
  constructor(private readonly prisma: PrismaService) {}

  private exigirDueno(esDueno: boolean) {
    if (!esDueno) {
      throw new ForbiddenException('Solo el dueño del negocio puede editar las plantillas de proyectos.');
    }
  }

  /**
   * Lista las plantillas activas de la empresa. Si todavía no tiene ninguna
   * (ni activa ni archivada), crea las 4 de ejemplo y las devuelve.
   */
  async listar(empresaId: string) {
    const total = await this.prisma.plantillaProyecto.count({ where: { empresaId } });
    if (total === 0) {
      await this.prisma.$transaction(async (tx) => {
        const recheck = await tx.plantillaProyecto.count({ where: { empresaId } });
        if (recheck > 0) return;
        for (const p of PLANTILLAS_EJEMPLO) {
          await tx.plantillaProyecto.create({
            data: {
              empresaId,
              nombre: p.nombre,
              descripcion: p.descripcion,
              orden: p.orden,
              activa: true,
              etapas: {
                create: p.etapas.map((e) => ({
                  orden: e.orden,
                  nombre: e.nombre,
                  diasObjetivo: e.diasObjetivo,
                  aprobacion: e.aprobacion,
                })),
              },
            },
          });
        }
      });
    }

    const filas = await this.prisma.plantillaProyecto.findMany({
      where: { empresaId, activa: true },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
      include: {
        etapas: { orderBy: { orden: 'asc' } },
      },
    });

    return filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      descripcion: f.descripcion,
      activa: f.activa,
      orden: f.orden,
      etapas: f.etapas.map((e) => ({
        id: e.id,
        orden: e.orden,
        nombre: e.nombre,
        diasObjetivo: e.diasObjetivo,
        aprobacion: e.aprobacion as TipoAprobacion,
        aprobadorInternoId: e.aprobadorInternoId,
      })),
    }));
  }

  async crear(empresaId: string, esDueno: boolean, input: PlantillaProyectoInput) {
    this.exigirDueno(esDueno);
    if (input.etapas.length === 0) {
      throw new BadRequestException('Agregá al menos una etapa a la plantilla');
    }
    const maxOrden = await this.prisma.plantillaProyecto.aggregate({
      where: { empresaId },
      _max: { orden: true },
    });
    const creada = await this.prisma.plantillaProyecto.create({
      data: {
        empresaId,
        nombre: input.nombre.trim(),
        descripcion: input.descripcion?.trim() || null,
        orden: input.orden ?? (maxOrden._max.orden ?? 0) + 1,
        activa: true,
        etapas: {
          create: input.etapas.map((e, idx) => ({
            orden: idx + 1,
            nombre: e.nombre.trim(),
            diasObjetivo: e.diasObjetivo ?? null,
            aprobacion: e.aprobacion ?? 'ninguna',
            aprobadorInternoId: e.aprobadorInternoId ?? null,
          })),
        },
      },
      include: { etapas: { orderBy: { orden: 'asc' } } },
    });
    return {
      id: creada.id,
      nombre: creada.nombre,
      descripcion: creada.descripcion,
      activa: creada.activa,
      orden: creada.orden,
      etapas: creada.etapas,
    };
  }

  async editar(empresaId: string, esDueno: boolean, id: string, input: PlantillaProyectoInput) {
    this.exigirDueno(esDueno);
    if (input.etapas.length === 0) {
      throw new BadRequestException('Agregá al menos una etapa a la plantilla');
    }
    const existente = await this.prisma.plantillaProyecto.findFirst({
      where: { id, empresaId },
      select: { id: true },
    });
    if (!existente) throw new NotFoundException('Plantilla no encontrada');

    return this.prisma.$transaction(async (tx) => {
      await tx.plantillaEtapa.deleteMany({ where: { plantillaId: id } });
      const actualizada = await tx.plantillaProyecto.update({
        where: { id },
        data: {
          nombre: input.nombre.trim(),
          descripcion: input.descripcion?.trim() || null,
          ...(input.orden !== undefined ? { orden: input.orden } : {}),
          etapas: {
            create: input.etapas.map((e, idx) => ({
              orden: idx + 1,
              nombre: e.nombre.trim(),
              diasObjetivo: e.diasObjetivo ?? null,
              aprobacion: e.aprobacion ?? 'ninguna',
              aprobadorInternoId: e.aprobadorInternoId ?? null,
            })),
          },
        },
        include: { etapas: { orderBy: { orden: 'asc' } } },
      });
      return {
        id: actualizada.id,
        nombre: actualizada.nombre,
        descripcion: actualizada.descripcion,
        activa: actualizada.activa,
        orden: actualizada.orden,
        etapas: actualizada.etapas,
      };
    });
  }

  async archivar(empresaId: string, esDueno: boolean, id: string) {
    this.exigirDueno(esDueno);
    const existente = await this.prisma.plantillaProyecto.findFirst({
      where: { id, empresaId },
      select: { id: true },
    });
    if (!existente) throw new NotFoundException('Plantilla no encontrada');
    await this.prisma.plantillaProyecto.update({
      where: { id },
      data: { activa: false },
    });
    return { ok: true };
  }
}
