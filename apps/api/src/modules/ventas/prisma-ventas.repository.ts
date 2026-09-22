import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Venta, VentaItem } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  ConfirmarVentaInput,
  EstadoCobro,
  FiltrosVentas,
  ListaVentas,
  ResultadoAnularVenta,
  ResultadoCobrarSaldo,
  ResultadoConfirmarVenta,
  VentaFicha,
  VentaRecord,
  VentasRepository,
} from './ventas.repository.js';
import { calcularTotalesCredito } from './ventas.util.js';

type VentaConItemsNombre = Venta & { items: (VentaItem & { producto: { nombre: string } })[] };

function calcularTotal(v: Venta, itemsTotal: number): number {
  const descuento = v.descuento.toNumber();
  const totalCon = v.totalConInteres?.toNumber() ?? 0;
  const totalSin = v.totalSinInteres?.toNumber() ?? 0;
  if (totalCon > 0) return totalCon;
  if (totalSin > 0) return totalSin;
  return itemsTotal - descuento;
}

@Injectable()
export class PrismaVentasRepository implements VentasRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toRecord(v: VentaConItemsNombre): VentaRecord {
    const itemsTotal = v.items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario.toNumber(), 0);
    return {
      id: v.id,
      empresaId: v.empresaId,
      numeroVenta: v.numeroVenta,
      fecha: v.fecha,
      formaPago: v.formaPago,
      descuento: v.descuento.toNumber(),
      clienteId: v.clienteId,
      clienteNombre: v.clienteNombre,
      cuotas: v.cuotas,
      coeficienteInteres: v.coeficienteInteres.toNumber(),
      totalSinInteres: v.totalSinInteres?.toNumber() ?? null,
      totalConInteres: v.totalConInteres?.toNumber() ?? null,
      notas: v.notas,
      anulada: v.deletedAt != null,
      esSenia: v.esSenia,
      montoSenia: v.montoSenia.toNumber(),
      saldoPendiente: v.saldoPendiente.toNumber(),
      estadoCobro: v.estadoCobro as EstadoCobro,
      fechaCobroSaldo: v.fechaCobroSaldo,
      productos: v.items.map((i) => `${i.producto.nombre} × ${i.cantidad}`).join(', '),
      total: calcularTotal(v, itemsTotal),
    };
  }

  async listar(empresaId: string, filtro: FiltrosVentas): Promise<ListaVentas> {
    const clienteQ = filtro.cliente.trim();
    const numeroQ = filtro.numeroVenta.trim();
    const porNumero = numeroQ.length > 0;
    const where: Prisma.VentaWhereInput = {
      empresaId,
      ...(filtro.mostrarAnuladas ? { deletedAt: { not: null } } : { deletedAt: null }),
      ...(!porNumero && filtro.desde && filtro.hasta
        ? { fecha: { gte: new Date(`${filtro.desde}T00:00:00.000-03:00`), lte: new Date(`${filtro.hasta}T23:59:59.999-03:00`) } }
        : {}),
      ...(filtro.forma ? { formaPago: filtro.forma } : {}),
      ...(clienteQ ? { clienteNombre: { contains: clienteQ, mode: 'insensitive' } } : {}),
      ...(porNumero ? { numeroVenta: { contains: numeroQ, mode: 'insensitive' } } : {}),
      ...(filtro.productoId ? { items: { some: { productoId: filtro.productoId } } } : {}),
    };
    const from = (filtro.pagina - 1) * filtro.pageSize;
    const [filas, total] = await Promise.all([
      this.prisma.venta.findMany({
        where,
        include: { items: { include: { producto: { select: { nombre: true } } } } },
        orderBy: { fecha: 'desc' },
        skip: from,
        take: filtro.pageSize,
      }),
      this.prisma.venta.count({ where }),
    ]);
    return { items: filas.map((v) => this.toRecord(v)), total };
  }

  async ficha(empresaId: string, id: string): Promise<VentaFicha | null> {
    const venta = await this.prisma.venta.findFirst({
      where: { id, empresaId },
      include: { items: { include: { producto: { select: { nombre: true } } } } },
    });
    if (!venta) return null;
    return {
      ...this.toRecord(venta),
      items: venta.items.map((i) => ({
        productoNombre: i.producto.nombre,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario.toNumber(),
      })),
    };
  }

  async rango(empresaId: string): Promise<{ desde: string; hasta: string } | null> {
    const primera = await this.prisma.venta.findFirst({
      where: { empresaId, deletedAt: null },
      orderBy: { fecha: 'asc' },
      select: { fecha: true },
    });
    if (!primera) return null;
    const ultima = await this.prisma.venta.findFirst({
      where: { empresaId, deletedAt: null },
      orderBy: { fecha: 'desc' },
      select: { fecha: true },
    });
    return {
      desde: primera.fecha.toISOString().slice(0, 10),
      hasta: (ultima?.fecha ?? primera.fecha).toISOString().slice(0, 10),
    };
  }

  async confirmar(empresaId: string, input: ConfirmarVentaInput): Promise<ResultadoConfirmarVenta> {
    if (input.items.length === 0) return { ok: false, motivo: 'sin_productos' };

    return this.prisma.$transaction(async (tx) => {
      const productoIds = [...new Set(input.items.map((i) => i.productoId))];
      const productos = await tx.producto.findMany({ where: { id: { in: productoIds }, empresaId } });
      if (productos.length !== productoIds.length) return { ok: false, motivo: 'producto_invalido' };
      const costoProducto = new Map(productos.map((p) => [p.id, p.costo?.toNumber() ?? 0]));

      const varianteIds = [...new Set(input.items.filter((i) => i.varianteId).map((i) => i.varianteId!))];
      const costoVariante = new Map<string, number>();
      if (varianteIds.length > 0) {
        const variantes = await tx.productoVariante.findMany({ where: { id: { in: varianteIds }, empresaId } });
        if (variantes.length !== varianteIds.length) return { ok: false, motivo: 'variante_invalida' };
        const productoDeVariante = new Map(variantes.map((v) => [v.id, v.productoId]));
        const todasValidas = input.items.every(
          (i) => !i.varianteId || productoDeVariante.get(i.varianteId) === i.productoId,
        );
        if (!todasValidas) return { ok: false, motivo: 'variante_invalida' };
        for (const v of variantes) costoVariante.set(v.id, v.costo?.toNumber() ?? 0);
      }

      if (input.clienteId) {
        const cliente = await tx.cliente.findFirst({ where: { id: input.clienteId, empresaId } });
        if (!cliente) return { ok: false, motivo: 'cliente_invalido' };
      }
      if (input.ubicacionOrigen) {
        const ubicacion = await tx.ubicacion.findFirst({ where: { empresaId, nombre: input.ubicacionOrigen } });
        if (!ubicacion) return { ok: false, motivo: 'ubicacion_invalida' };
      }

      // Los totales se recalculan siempre acá - nunca se confía en un monto
      // que mande el cliente para algo que involucra dinero.
      const itemsTotal = input.items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);
      const totalSinInteres = itemsTotal - input.descuento;
      const { totalConInteres } = calcularTotalesCredito(totalSinInteres, input.coeficienteInteres, input.cuotas);

      if (input.esSenia && !(input.montoSenia > 0 && input.montoSenia < totalConInteres)) {
        return { ok: false, motivo: 'senia_invalida' };
      }

      const numeracion = await tx.ventaNumeracion.upsert({
        where: { empresaId },
        create: { empresaId, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      });

      const saldoPendiente = input.esSenia ? totalConInteres - input.montoSenia : 0;
      const estadoCobro: EstadoCobro = input.esSenia ? 'señado' : 'pagado';

      const venta = await tx.venta.create({
        data: {
          empresaId,
          usuarioId: input.usuarioId,
          clienteId: input.clienteId ?? null,
          clienteNombre: input.clienteNombre,
          numeroVenta: String(numeracion.ultimo),
          formaPago: input.formaPago,
          descuento: input.descuento,
          cuotas: input.cuotas,
          coeficienteInteres: input.coeficienteInteres,
          totalSinInteres,
          totalConInteres,
          esSenia: input.esSenia,
          montoSenia: input.esSenia ? input.montoSenia : 0,
          saldoPendiente,
          estadoCobro,
          items: {
            create: input.items.map((i) => ({
              empresaId,
              productoId: i.productoId,
              varianteId: i.varianteId ?? null,
              cantidad: i.cantidad,
              precioUnitario: i.precioUnitario,
              costoUnitario: i.varianteId ? (costoVariante.get(i.varianteId) ?? 0) : (costoProducto.get(i.productoId) ?? 0),
            })),
          },
        },
        include: { items: { include: { producto: { select: { nombre: true } } } } },
      });

      for (const item of input.items) {
        await tx.movimientoInventario.create({
          data: {
            empresaId,
            productoId: item.productoId,
            varianteId: item.varianteId ?? null,
            loteId: item.loteId ?? null,
            usuarioId: input.usuarioId,
            tipo: 'venta',
            cantidad: item.cantidad,
            signo: -1,
            precioUnitario: item.precioUnitario,
            ubicacionOrigen: input.ubicacionOrigen ?? null,
            referenciaId: venta.id,
          },
        });
      }

      return { ok: true, venta: this.toRecord(venta) };
    });
  }

  async anular(empresaId: string, usuarioId: string, id: string, motivo: string): Promise<ResultadoAnularVenta> {
    return this.prisma.$transaction(async (tx) => {
      const venta = await tx.venta.findFirst({ where: { id, empresaId } });
      if (!venta) return 'no_encontrada';
      if (venta.deletedAt) return 'ya_anulada';

      const movimientosOriginales = await tx.movimientoInventario.findMany({
        where: { empresaId, referenciaId: id, tipo: 'venta', signo: -1, deletedAt: null },
      });
      for (const m of movimientosOriginales) {
        await tx.movimientoInventario.create({
          data: {
            empresaId,
            productoId: m.productoId,
            varianteId: m.varianteId,
            loteId: m.loteId,
            usuarioId,
            tipo: 'venta',
            cantidad: m.cantidad,
            signo: 1,
            precioUnitario: m.precioUnitario,
            ubicacionDestino: m.ubicacionOrigen,
            motivo: `Anulación: ${motivo}`,
            referenciaId: id,
          },
        });
      }

      await tx.venta.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.anulacion.create({ data: { empresaId, ventaId: id, usuarioId, motivo } });
      return 'ok';
    });
  }

  async cobrarSaldo(
    empresaId: string,
    id: string,
    monto: number,
    formaPago: string,
    fecha: Date,
  ): Promise<ResultadoCobrarSaldo> {
    return this.prisma.$transaction(async (tx) => {
      const venta = await tx.venta.findFirst({ where: { id, empresaId, deletedAt: null } });
      if (!venta) return { ok: false, motivo: 'no_encontrada' };
      const saldoActual = venta.saldoPendiente.toNumber();
      if (!venta.esSenia || saldoActual <= 0) return { ok: false, motivo: 'sin_saldo_pendiente' };
      if (!(monto > 0 && monto <= saldoActual)) return { ok: false, motivo: 'monto_invalido' };

      const nuevoSaldo = saldoActual - monto;
      const pagado = nuevoSaldo <= 0;
      const nota = `Saldo cobrado el ${fecha.toISOString().slice(0, 10)}: $${monto} (${formaPago})`;
      const actualizada = await tx.venta.update({
        where: { id },
        data: {
          saldoPendiente: pagado ? 0 : nuevoSaldo,
          estadoCobro: pagado ? 'pagado' : 'señado',
          fechaCobroSaldo: pagado ? fecha : venta.fechaCobroSaldo,
          notas: venta.notas ? `${venta.notas}\n${nota}` : nota,
        },
        include: { items: { include: { producto: { select: { nombre: true } } } } },
      });
      return { ok: true, venta: this.toRecord(actualizada) };
    });
  }
}
