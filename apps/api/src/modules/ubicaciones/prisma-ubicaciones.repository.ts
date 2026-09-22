import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { esViolacionUnica } from '../../common/prisma-errors.util.js';
import type {
  GuardarUbicacionInput,
  ResultadoGuardarUbicacion,
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

  async crear(empresaId: string, input: GuardarUbicacionInput): Promise<ResultadoGuardarUbicacion> {
    try {
      const creada = await this.prisma.ubicacion.create({
        data: { empresaId, nombre: input.nombre, descripcion: input.descripcion, tipo: input.tipo, activo: input.activo },
      });
      return { ok: true, ubicacion: this.toRecord(creada) };
    } catch (error) {
      if (esViolacionUnica(error)) return { ok: false, motivo: 'nombre_duplicado' };
      throw error;
    }
  }

  async actualizar(empresaId: string, id: string, input: GuardarUbicacionInput): Promise<ResultadoGuardarUbicacion> {
    try {
      const { count } = await this.prisma.ubicacion.updateMany({
        where: { id, empresaId },
        data: { nombre: input.nombre, descripcion: input.descripcion, tipo: input.tipo, activo: input.activo },
      });
      if (count === 0) return { ok: false, motivo: 'no_encontrada' };
      const actualizada = await this.buscarPorId(empresaId, id);
      return { ok: true, ubicacion: actualizada! };
    } catch (error) {
      if (esViolacionUnica(error)) return { ok: false, motivo: 'nombre_duplicado' };
      throw error;
    }
  }

  async buscarPorId(empresaId: string, id: string): Promise<UbicacionRecord | null> {
    const fila = await this.prisma.ubicacion.findFirst({ where: { id, empresaId } });
    return fila ? this.toRecord(fila) : null;
  }

  async eliminar(empresaId: string, id: string): Promise<'ok' | 'no_encontrada' | 'tiene_movimientos'> {
    // Chequeo "¿tiene movimientos?" + delete en una sola transacción -
    // evita la ventana TOCTOU donde un traslado podía commitear justo entre
    // el findFirst y el delete (ubicacionOrigen/Destino son texto libre, sin
    // FK, así que Postgres no lo bloquea por sí solo).
    return this.prisma.$transaction(async (tx) => {
      const ubicacion = await tx.ubicacion.findFirst({ where: { id, empresaId } });
      if (!ubicacion) return 'no_encontrada';

      const conMovimientos = await tx.movimientoInventario.findFirst({
        where: {
          empresaId,
          deletedAt: null,
          OR: [{ ubicacionOrigen: ubicacion.nombre }, { ubicacionDestino: ubicacion.nombre }],
        },
        select: { id: true },
      });
      if (conMovimientos) return 'tiene_movimientos';

      await tx.ubicacion.delete({ where: { id } });
      return 'ok';
    });
  }
}
