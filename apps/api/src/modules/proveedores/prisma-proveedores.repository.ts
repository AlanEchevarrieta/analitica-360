import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CompraProveedorResumen,
  GuardarProveedorInput,
  ListaProveedores,
  ProveedorRecord,
  ProveedoresRepository,
} from './proveedores.repository.js';

function soloDigitos(valor: string | null, maxLen: number): string | null {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, '').slice(0, maxLen);
  return digitos || null;
}

@Injectable()
export class PrismaProveedoresRepository implements ProveedoresRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(p: {
    id: string;
    empresaId: string;
    nombre: string;
    razonSocial: string | null;
    nombreComercial: string | null;
    cuit: string | null;
    condicionAfip: string | null;
    nombreVendedor: string | null;
    telefono: string | null;
    email: string | null;
    productosQueProvee: string | null;
    condicionesPago: string | null;
    formasPagoAceptadas: string[];
    plazoEntrega: string | null;
    cbu: string | null;
    aliasCbu: string | null;
    banco: string | null;
    notas: string | null;
    activo: boolean;
  }): ProveedorRecord {
    return p;
  }

  private data(input: GuardarProveedorInput) {
    return {
      nombre: input.nombre,
      razonSocial: input.razonSocial,
      nombreComercial: input.nombreComercial,
      cuit: soloDigitos(input.cuit, 11),
      condicionAfip: input.condicionAfip,
      nombreVendedor: input.nombreVendedor,
      telefono: input.telefono,
      email: input.email,
      productosQueProvee: input.productosQueProvee,
      condicionesPago: input.condicionesPago,
      formasPagoAceptadas: input.formasPagoAceptadas,
      plazoEntrega: input.plazoEntrega,
      cbu: soloDigitos(input.cbu, 22),
      aliasCbu: input.aliasCbu,
      banco: input.banco,
      notas: input.notas,
      activo: input.activo,
    };
  }

  async listar(
    empresaId: string,
    filtro: { pagina: number; pageSize: number; busqueda: string },
  ): Promise<ListaProveedores> {
    const busqueda = filtro.busqueda.trim();
    const where: Prisma.ProveedorWhereInput = {
      empresaId,
      deletedAt: null,
      ...(busqueda
        ? {
            OR: [
              { nombre: { contains: busqueda, mode: 'insensitive' } },
              { razonSocial: { contains: busqueda, mode: 'insensitive' } },
              { nombreComercial: { contains: busqueda, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const from = (filtro.pagina - 1) * filtro.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.proveedor.findMany({ where, orderBy: { nombre: 'asc' }, skip: from, take: filtro.pageSize }),
      this.prisma.proveedor.count({ where }),
    ]);
    return { items: items.map((p) => this.toRecord(p)), total };
  }

  async crear(empresaId: string, input: GuardarProveedorInput): Promise<ProveedorRecord> {
    const creado = await this.prisma.proveedor.create({ data: { empresaId, ...this.data(input) } });
    return this.toRecord(creado);
  }

  async actualizar(empresaId: string, id: string, input: GuardarProveedorInput): Promise<ProveedorRecord | null> {
    const { count } = await this.prisma.proveedor.updateMany({ where: { id, empresaId }, data: this.data(input) });
    if (count === 0) return null;
    return this.buscarPorId(empresaId, id);
  }

  async buscarPorId(empresaId: string, id: string): Promise<ProveedorRecord | null> {
    const fila = await this.prisma.proveedor.findFirst({ where: { id, empresaId, deletedAt: null } });
    return fila ? this.toRecord(fila) : null;
  }

  async historialCompras(empresaId: string, id: string): Promise<CompraProveedorResumen[]> {
    const compras = await this.prisma.compra.findMany({
      where: { empresaId, proveedorId: id, deletedAt: null },
      include: { items: { select: { productoNombre: true, cantidad: true } } },
      orderBy: { fecha: 'desc' },
    });
    return compras.map((c) => ({
      id: c.id,
      fecha: c.fecha.toISOString().slice(0, 10),
      productos: c.items.map((i) => `${i.productoNombre} × ${i.cantidad}`).join(', '),
      total: c.total?.toNumber() ?? 0,
      notas: c.notas,
    }));
  }
}
