import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { esViolacionUnica } from '../../common/prisma-errors.util.js';
import { PrismaService } from '../../database/prisma.service.js';

export interface ListaPrecioRecord {
  id: string;
  nombre: string;
  ajustePct: number;
  redondeo: number;
  clientes: number;
}

export interface GuardarListaPrecio {
  nombre: string;
  ajustePct: number;
  redondeo: number;
}

@Injectable()
export class ListasPreciosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(empresaId: string): Promise<ListaPrecioRecord[]> {
    const listas = await this.prisma.listaPrecio.findMany({
      where: { empresaId, deletedAt: null },
      select: { id: true, nombre: true, ajustePct: true, redondeo: true, _count: { select: { clientes: { where: { deletedAt: null } } } } },
      orderBy: { nombre: 'asc' },
    });
    return listas.map((l) => ({ id: l.id, nombre: l.nombre, ajustePct: l.ajustePct.toNumber(), redondeo: l.redondeo, clientes: l._count.clientes }));
  }

  async crear(empresaId: string, input: GuardarListaPrecio) {
    try {
      await this.prisma.listaPrecio.create({ data: { empresaId, ...input } });
    } catch (e) {
      throw this.traducir(e);
    }
    return this.listar(empresaId);
  }

  async actualizar(empresaId: string, id: string, input: GuardarListaPrecio) {
    try {
      const { count } = await this.prisma.listaPrecio.updateMany({ where: { id, empresaId, deletedAt: null }, data: input });
      if (count === 0) throw new NotFoundException('Lista de precios no encontrada');
    } catch (e) {
      throw this.traducir(e);
    }
    return this.listar(empresaId);
  }

  /** Baja lógica: las ventas viejas conservan la referencia; los clientes vuelven al precio normal. */
  async eliminar(empresaId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.listaPrecio.updateMany({ where: { id, empresaId, deletedAt: null }, data: { deletedAt: new Date() } });
      if (count === 0) throw new NotFoundException('Lista de precios no encontrada');
      await tx.cliente.updateMany({ where: { empresaId, listaPrecioId: id }, data: { listaPrecioId: null } });
    });
    return this.listar(empresaId);
  }

  /** Verifica que la lista exista y sea de la empresa (para clientes y ventas). */
  async validar(empresaId: string, id: string | null | undefined) {
    if (!id) return;
    const lista = await this.prisma.listaPrecio.findFirst({ where: { id, empresaId, deletedAt: null }, select: { id: true } });
    if (!lista) throw new BadRequestException('Esa lista de precios no existe en tu empresa');
  }

  private traducir(e: unknown) {
    if (esViolacionUnica(e)) return new ConflictException('Ya existe una lista con ese nombre');
    return e;
  }
}
