import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  EstadoOc,
  GuardarOrdenCompraInput,
  ItemOcInput,
  MotivoRechazoOc,
  OrdenCompraFicha,
  OrdenCompraItemRecord,
  OrdenCompraRecord,
  OrdenesCompraRepository,
  ResultadoGuardarOc,
  ResultadoRecepcionOc,
} from './ordenes-compra.repository.js';

const includeCabecera = {
  proveedor: { select: { nombre: true, nombreComercial: true, telefono: true, email: true, cuit: true, nombreVendedor: true } },
} satisfies Prisma.OrdenCompraInclude;

const includeFicha = {
  ...includeCabecera,
  items: { include: { producto: { select: { nombre: true } }, variante: { select: { atributos: true } } } },
} satisfies Prisma.OrdenCompraInclude;

type OcConCabecera = Prisma.OrdenCompraGetPayload<{ include: typeof includeCabecera }>;
type OcConFicha = Prisma.OrdenCompraGetPayload<{ include: typeof includeFicha }>;

function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function etiquetaAtributos(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const partes = Object.values(raw as Record<string, unknown>)
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
  return partes.length ? partes.join('/') : null;
}

@Injectable()
export class PrismaOrdenesCompraRepository implements OrdenesCompraRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(oc: OcConCabecera): OrdenCompraRecord {
    return {
      id: oc.id,
      empresaId: oc.empresaId,
      numeroOc: oc.numeroOc,
      proveedorId: oc.proveedorId,
      proveedorNombre: oc.proveedor ? oc.proveedor.nombre || oc.proveedor.nombreComercial : null,
      estado: oc.estado as EstadoOc,
      fechaEmision: isoDate(oc.fechaEmision) ?? isoDate(oc.createdAt)!,
      fechaEntregaEstimada: isoDate(oc.fechaEntregaEstimada),
      notas: oc.notas,
      total: oc.total.toNumber(),
    };
  }

  private toFicha(oc: OcConFicha): OrdenCompraFicha {
    const contacto = oc.proveedor
      ? [oc.proveedor.nombreVendedor, oc.proveedor.telefono, oc.proveedor.email].filter(Boolean).join(' · ') || null
      : null;
    const items: OrdenCompraItemRecord[] = oc.items.map((it) => ({
      id: it.id,
      productoId: it.productoId,
      varianteId: it.varianteId,
      productoNombre: it.producto.nombre,
      varianteEtiqueta: etiquetaAtributos(it.variante?.atributos),
      cantidadPedida: it.cantidadPedida.toNumber(),
      precioUnitario: it.precioUnitario.toNumber(),
      cantidadRecibida: it.cantidadRecibida.toNumber(),
      recibido: it.recibido,
    }));
    return {
      ...this.toRecord(oc),
      items,
      proveedorContacto: contacto,
      proveedorCuit: oc.proveedor?.cuit ?? null,
    };
  }

  /** null si es válido, el motivo de rechazo si no. Corre dentro de la misma tx que crea/actualiza la OC. */
  private async validarReferencias(
    tx: Prisma.TransactionClient,
    empresaId: string,
    proveedorId: string | null,
    items: ItemOcInput[],
  ): Promise<MotivoRechazoOc | null> {
    if (proveedorId) {
      const proveedor = await tx.proveedor.findFirst({ where: { id: proveedorId, empresaId } });
      if (!proveedor) return 'proveedor_invalido';
    }
    const productoIds = [...new Set(items.map((i) => i.productoId))];
    const productos = await tx.producto.findMany({ where: { id: { in: productoIds }, empresaId } });
    if (productos.length !== productoIds.length) return 'producto_invalido';

    const varianteIds = [...new Set(items.filter((i) => i.varianteId).map((i) => i.varianteId!))];
    if (varianteIds.length > 0) {
      const variantes = await tx.productoVariante.findMany({ where: { id: { in: varianteIds }, empresaId } });
      if (variantes.length !== varianteIds.length) return 'variante_invalida';
      const productoDeVariante = new Map(variantes.map((v) => [v.id, v.productoId]));
      const todasValidas = items.every((i) => !i.varianteId || productoDeVariante.get(i.varianteId) === i.productoId);
      if (!todasValidas) return 'variante_invalida';
    }
    return null;
  }

  async listar(empresaId: string, filtro: { estado: string; proveedorId: string }): Promise<OrdenCompraRecord[]> {
    const where: Prisma.OrdenCompraWhereInput = {
      empresaId,
      deletedAt: null,
      ...(filtro.estado && filtro.estado !== 'todos' ? { estado: filtro.estado } : {}),
      ...(filtro.proveedorId ? { proveedorId: filtro.proveedorId } : {}),
    };
    const filas = await this.prisma.ordenCompra.findMany({ where, include: includeCabecera, orderBy: { createdAt: 'desc' } });
    return filas.map((oc) => this.toRecord(oc));
  }

  async ficha(empresaId: string, id: string): Promise<OrdenCompraFicha | null> {
    const oc = await this.prisma.ordenCompra.findFirst({ where: { id, empresaId, deletedAt: null }, include: includeFicha });
    return oc ? this.toFicha(oc) : null;
  }

  async crear(empresaId: string, input: GuardarOrdenCompraInput): Promise<ResultadoGuardarOc> {
    return this.prisma.$transaction(async (tx) => {
      const motivo = await this.validarReferencias(tx, empresaId, input.proveedorId, input.items);
      if (motivo) return { ok: false, motivo };

      const numeracion = await tx.ordenCompraNumeracion.upsert({
        where: { empresaId },
        create: { empresaId, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      });
      const total = input.items.reduce((acc, i) => acc + i.cantidadPedida * i.precioUnitario, 0);

      const creada = await tx.ordenCompra.create({
        data: {
          empresaId,
          numeroOc: `OC-${numeracion.ultimo}`,
          proveedorId: input.proveedorId,
          fechaEmision: new Date(),
          fechaEntregaEstimada: input.fechaEntregaEstimada,
          notas: input.notas,
          estado: input.estado,
          total,
          items: {
            create: input.items.map((i) => ({
              productoId: i.productoId,
              varianteId: i.varianteId,
              cantidadPedida: i.cantidadPedida,
              precioUnitario: i.precioUnitario,
            })),
          },
        },
        include: includeFicha,
      });
      return { ok: true, orden: this.toFicha(creada) };
    });
  }

  async actualizar(empresaId: string, id: string, input: GuardarOrdenCompraInput): Promise<ResultadoGuardarOc> {
    return this.prisma.$transaction(async (tx) => {
      const existente = await tx.ordenCompra.findFirst({ where: { id, empresaId } });
      if (!existente) return { ok: false, motivo: 'no_encontrada' };

      const motivo = await this.validarReferencias(tx, empresaId, input.proveedorId, input.items);
      if (motivo) return { ok: false, motivo };

      const total = input.items.reduce((acc, i) => acc + i.cantidadPedida * i.precioUnitario, 0);
      await tx.ordenCompraItem.deleteMany({ where: { ordenCompraId: id } });
      const actualizada = await tx.ordenCompra.update({
        where: { id },
        data: {
          proveedorId: input.proveedorId,
          fechaEntregaEstimada: input.fechaEntregaEstimada,
          notas: input.notas,
          estado: input.estado,
          total,
          items: {
            create: input.items.map((i) => ({
              productoId: i.productoId,
              varianteId: i.varianteId,
              cantidadPedida: i.cantidadPedida,
              precioUnitario: i.precioUnitario,
            })),
          },
        },
        include: includeFicha,
      });
      return { ok: true, orden: this.toFicha(actualizada) };
    });
  }

  async actualizarEstado(empresaId: string, id: string, estado: EstadoOc): Promise<OrdenCompraRecord | null> {
    const { count } = await this.prisma.ordenCompra.updateMany({ where: { id, empresaId }, data: { estado } });
    if (count === 0) return null;
    const oc = await this.prisma.ordenCompra.findFirst({ where: { id, empresaId }, include: includeCabecera });
    return oc ? this.toRecord(oc) : null;
  }

  async registrarRecepcion(
    empresaId: string,
    usuarioId: string,
    id: string,
    cantidades: Record<string, number>,
  ): Promise<ResultadoRecepcionOc> {
    return this.prisma.$transaction(async (tx) => {
      const orden = await tx.ordenCompra.findFirst({ where: { id, empresaId, deletedAt: null }, include: includeFicha });
      if (!orden) return { ok: false, motivo: 'no_encontrada' };
      const ficha = this.toFicha(orden);

      const lote = ficha.items
        .map((item) => {
          const pedida = Math.max(0, Number(cantidades[item.id] ?? 0));
          const pendiente = Math.max(0, item.cantidadPedida - item.cantidadRecibida);
          return { item, qty: Math.min(pedida, pendiente) };
        })
        .filter((l) => l.qty > 0);
      if (lote.length === 0) return { ok: false, motivo: 'sin_cantidades' };

      const total = lote.reduce((acc, l) => acc + l.qty * l.item.precioUnitario, 0);
      const compra = await tx.compra.create({
        data: {
          empresaId,
          usuarioId,
          proveedorNombre: ficha.proveedorNombre,
          proveedorId: ficha.proveedorId,
          ordenCompraId: ficha.id,
          fecha: new Date(),
          total,
          totalReal: total,
          notas: `Generada desde ${ficha.numeroOc}`,
          items: {
            create: lote.map(({ item, qty }) => ({
              empresaId,
              productoId: item.productoId,
              varianteId: item.varianteId,
              productoNombre: item.varianteEtiqueta ? `${item.productoNombre} (${item.varianteEtiqueta})` : item.productoNombre,
              cantidad: qty,
              costoUnitario: item.precioUnitario,
              subtotal: qty * item.precioUnitario,
            })),
          },
        },
      });

      for (const { item, qty } of lote) {
        await tx.movimientoInventario.create({
          data: {
            empresaId,
            productoId: item.productoId,
            varianteId: item.varianteId,
            usuarioId,
            tipo: 'compra',
            cantidad: qty,
            signo: 1,
            costoUnitario: item.precioUnitario,
            referenciaId: compra.id,
          },
        });
        // increment atómico en vez de leer cantidadRecibida (de la ficha
        // capturada al principio de la transacción) y escribir un valor
        // absoluto - dos recepciones parciales concurrentes sobre el mismo
        // item podían pisarse y perder una de las dos.
        await tx.ordenCompraItem.update({
          where: { id: item.id },
          data: { cantidadRecibida: { increment: qty } },
        });
      }

      // recibido/el estado de la OC se calculan releyendo los items ya
      // actualizados (post-increment), no desde la ficha stale de arriba.
      const itemsActualizados = await tx.ordenCompraItem.findMany({ where: { ordenCompraId: id } });
      for (const it of itemsActualizados) {
        const completoAhora = it.cantidadRecibida.toNumber() >= it.cantidadPedida.toNumber();
        if (it.recibido !== completoAhora) {
          await tx.ordenCompraItem.update({ where: { id: it.id }, data: { recibido: completoAhora } });
        }
      }
      const completa = itemsActualizados.every((it) => it.cantidadRecibida.toNumber() >= it.cantidadPedida.toNumber());
      const alguna = itemsActualizados.some((it) => it.cantidadRecibida.toNumber() > 0);
      const nuevoEstado: EstadoOc = completa ? 'recibida' : alguna ? 'recibida_parcial' : ficha.estado;
      const actualizada = await tx.ordenCompra.update({
        where: { id },
        data: { estado: nuevoEstado },
        include: includeFicha,
      });
      return { ok: true, orden: this.toFicha(actualizada) };
    });
  }
}
