import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  GuardarUbicacionInput,
  TipoUbicacion,
  UbicacionRecord,
  UbicacionesRepository,
} from './ubicaciones.repository.js';

@Injectable()
export class PrismaUbicacionesRepository implements UbicacionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(u: { id: string; empresaId: string; nombre: string; descripcion: string | null; tipo: string; activo: boolean }): UbicacionRecord {
    return { ...u, tipo: u.tipo as TipoUbicacion };
  }

  async listar(empresaId: string, soloActivas: boolean): Promise<UbicacionRecord[]> {
    const filas = await this.prisma.ubicacion.findMany({
      where: { empresaId, ...(soloActivas ? { activo: true } : {}) },
      orderBy: { nombre: 'asc' },
    });
    return filas.map((u) => this.toRecord(u));
  }

  async crear(empresaId: string, input: GuardarUbicacionInput): Promise<UbicacionRecord> {
    const creada = await this.prisma.ubicacion.create({
      data: { empresaId, nombre: input.nombre, descripcion: input.descripcion, tipo: input.tipo, activo: input.activo },
    });
    return this.toRecord(creada);
  }

  async actualizar(empresaId: string, id: string, input: GuardarUbicacionInput): Promise<UbicacionRecord | null> {
    const { count } = await this.prisma.ubicacion.updateMany({
      where: { id, empresaId },
      data: { nombre: input.nombre, descripcion: input.descripcion, tipo: input.tipo, activo: input.activo },
    });
    if (count === 0) return null;
    return this.buscarPorId(empresaId, id);
  }

  async buscarPorId(empresaId: string, id: string): Promise<UbicacionRecord | null> {
    const fila = await this.prisma.ubicacion.findFirst({ where: { id, empresaId } });
    return fila ? this.toRecord(fila) : null;
  }

  async eliminar(empresaId: string, id: string): Promise<'ok' | 'no_encontrada' | 'tiene_movimientos'> {
    const ubicacion = await this.prisma.ubicacion.findFirst({ where: { id, empresaId } });
    if (!ubicacion) return 'no_encontrada';

    const conMovimientos = await this.prisma.movimientoInventario.findFirst({
      where: {
        empresaId,
        deletedAt: null,
        OR: [{ ubicacionOrigen: ubicacion.nombre }, { ubicacionDestino: ubicacion.nombre }],
      },
      select: { id: true },
    });
    if (conMovimientos) return 'tiene_movimientos';

    await this.prisma.ubicacion.delete({ where: { id } });
    return 'ok';
  }
}
