import { salidasConKits } from '../produccion/kits.js';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Venta, VentaItem } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { esViolacionUnica } from '../../common/prisma-errors.util.js';
import type {
  ConfiguracionVenta,
  ConfirmarVentaInput,
  MotivoRechazoVenta,
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
import { calcularTotalesCredito, configuracionVentaDesde } from './ventas.util.js';

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
      include: {
        items: { include: { producto: { select: { nombre: true } }, variante: { select: { atributos: true } } } },
        listaPrecio: { select: { nombre: true } },
      },
    });
    if (!venta) return null;
    const devueltas = await this.prisma.devolucionItem.groupBy({
      by: ['productoId', 'varianteId'],
      where: { tipo: 'devuelto', devolucion: { ventaId: id, empresaId, estado: { not: 'cancelado' } } },
      _sum: { cantidad: true },
    });
    const devueltasDe = (productoId: string, varianteId: string | null) =>
      devueltas.find((d) => d.productoId === productoId && d.varianteId === varianteId)?._sum.cantidad?.toNumber() ?? 0;
    return {
      ...this.toRecord(venta),
      listaPrecio: venta.listaPrecio?.nombre ?? null,
      items: venta.items.map((i) => ({
        productoNombre: i.producto.nombre,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario.toNumber(),
        productoId: i.productoId,
        varianteId: i.varianteId,
        varianteEtiqueta: i.variante
          ? Object.values(i.variante.atributos as Record<string, string>).filter(Boolean).join(' / ') || null
          : null,
        devueltas: devueltasDe(i.productoId, i.varianteId),
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
    const resultado = await this.prisma.$transaction((tx) => confirmarVentaEnTx(tx, empresaId, input));
    return resultado.ok ? { ok: true, venta: this.toRecord(resultado.venta) } : resultado;
  }

  async anular(empresaId: string, usuarioId: string, id: string, motivo: string): Promise<ResultadoAnularVenta> {
    return this.prisma.$transaction(async (tx) => {
      const venta = await tx.venta.findFirst({ where: { id, empresaId } });
      if (!venta) return 'no_encontrada';
      // Anular revierte todo lo vendido: si ya hubo devoluciones, esas unidades
      // volverían dos veces al stock. Primero hay que cancelar la devolución.
      const devolucionActiva = await tx.devolucion.findFirst({ where: { ventaId: id, empresaId, estado: { not: 'cancelado' } } });
      if (devolucionActiva) return 'tiene_devoluciones';

      // "Reclama" la anulación de forma atómica antes de revertir
      // movimientos - cierra la carrera de dos anulaciones concurrentes
      // (antes llegaban ambas a tx.anulacion.create() y la segunda tiraba
      // un P2002 sin capturar por la restricción única en ventaId).
      const { count } = await tx.venta.updateMany({
        where: { id, empresaId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (count === 0) return 'ya_anulada';

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

      try {
        await tx.anulacion.create({ data: { empresaId, ventaId: id, usuarioId, motivo } });
      } catch (error) {
        // Defensa en profundidad: el updateMany de arriba ya cierra la
        // carrera en el 99% de los casos, pero si igual se llega acá con la
        // fila única ya tomada, se traduce a 'ya_anulada' en vez de dejar
        // pasar un PrismaClientKnownRequestError crudo.
        if (esViolacionUnica(error)) return 'ya_anulada';
        throw error;
      }
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
    const venta = await this.prisma.venta.findFirst({ where: { id, empresaId, deletedAt: null } });
    if (!venta) return { ok: false, motivo: 'no_encontrada' };
    if (!venta.esSenia || venta.saldoPendiente.toNumber() <= 0) return { ok: false, motivo: 'sin_saldo_pendiente' };
    if (monto <= 0) return { ok: false, motivo: 'monto_invalido' };

    return this.prisma.$transaction(async (tx) => {
      // decrement atómico guardado por saldoPendiente >= monto en el WHERE -
      // antes se leía saldoPendiente, se restaba en JS y se escribía un
      // valor absoluto: dos cobros parciales concurrentes podían pisarse y
      // perder un pago del registro (lost update).
      const { count } = await tx.venta.updateMany({
        where: { id, empresaId, deletedAt: null, saldoPendiente: { gte: monto } },
        data: { saldoPendiente: { decrement: monto } },
      });
      if (count === 0) return { ok: false, motivo: 'monto_invalido' };

      const actual = await tx.venta.findFirstOrThrow({ where: { id } });
      const pagado = actual.saldoPendiente.toNumber() <= 0;
      const nota = `Saldo cobrado el ${fecha.toISOString().slice(0, 10)}: $${monto} (${formaPago})`;
      const actualizada = await tx.venta.update({
        where: { id },
        data: {
          estadoCobro: pagado ? 'pagado' : 'señado',
          fechaCobroSaldo: pagado ? fecha : actual.fechaCobroSaldo,
          notas: actual.notas ? `${actual.notas}\n${nota}` : nota,
        },
        include: { items: { include: { producto: { select: { nombre: true } } } } },
      });
      return { ok: true, venta: this.toRecord(actualizada) };
    });
  }

  async configuracion(empresaId: string): Promise<ConfiguracionVenta> {
    const config = await this.prisma.configuracionEmpresa.findUnique({ where: { empresaId } });
    const flujo = (config?.flujoVentas ?? {}) as Record<string, unknown>;
    const mostrar = flujo.mostrar_cliente;
    return {
      ...configuracionVentaDesde(config?.mediosPago, config?.tasasCuotas, config?.ubicacionVentaDefault ?? null),
      mostrarCliente: mostrar === 'siempre' || mostrar === 'no_mostrar' ? mostrar : 'opcional',
      crearClienteDesdeVenta: flujo.crear_desde_venta !== false,
    };
  }
}

/**
 * Crea la venta, congela el costo de cada ítem (PPP vigente) y descuenta el
 * stock, dentro de una transacción ya abierta. La usan VentasRepository y el
 * despacho de pedidos (PedidosRepository), así una venta de mostrador y un
 * pedido despachado calculan totales, costos y stock exactamente igual.
 */
export async function confirmarVentaEnTx(
  tx: Prisma.TransactionClient,
  empresaId: string,
  input: ConfirmarVentaInput,
): Promise<{ ok: true; venta: VentaConItemsNombre } | { ok: false; motivo: MotivoRechazoVenta }> {
  if (input.items.length === 0) return { ok: false, motivo: 'sin_productos' };
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
      // Variante sin costo propio: vale el costo del producto (igual que su precio).
      for (const v of variantes) costoVariante.set(v.id, v.costo?.toNumber() ?? costoProducto.get(v.productoId) ?? 0);
    }

    // Chequeos independientes en paralelo, no en serie (confirmar() es el
    // endpoint de escritura más llamado del módulo).
    const [cliente, ubicacion, lista] = await Promise.all([
      input.clienteId ? tx.cliente.findFirst({ where: { id: input.clienteId, empresaId } }) : null,
      input.ubicacionOrigen ? tx.ubicacion.findFirst({ where: { empresaId, nombre: input.ubicacionOrigen } }) : null,
      input.listaPrecioId ? tx.listaPrecio.findFirst({ where: { id: input.listaPrecioId, empresaId, deletedAt: null }, select: { id: true } }) : null,
    ]);
    if (input.clienteId && !cliente) return { ok: false, motivo: 'cliente_invalido' };
    if (input.listaPrecioId && !lista) return { ok: false, motivo: 'lista_invalida' };
    if (input.ubicacionOrigen && !ubicacion) return { ok: false, motivo: 'ubicacion_invalida' };

    // Los totales se recalculan siempre acá - nunca se confía en un monto
    // que mande el cliente para algo que involucra dinero.
    const itemsTotal = input.items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);
    if (input.descuento > itemsTotal) return { ok: false, motivo: 'descuento_invalido' };
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

    // Kits que se arman al vender: el stock sale de sus componentes y su costo es la suma de ellos.
    const expandidos = await salidasConKits(tx, empresaId, input.items.map((i) => ({ productoId: i.productoId, varianteId: i.varianteId ?? null, cantidad: i.cantidad })));

    const saldoPendiente = input.esSenia ? totalConInteres - input.montoSenia : 0;
    const estadoCobro: EstadoCobro = input.esSenia ? 'señado' : 'pagado';

    const venta = await tx.venta.create({
      data: {
        empresaId,
        usuarioId: input.usuarioId,
        clienteId: input.clienteId ?? null,
        listaPrecioId: input.listaPrecioId ?? null,
        clienteNombre: input.clienteNombre,
        // Mismo formato que el legacy (V-000569).
        numeroVenta: `V-${String(numeracion.ultimo).padStart(6, '0')}`,
        formaPago: input.formaPago,
        descuento: input.descuento,
        cuotas: input.cuotas,
        coeficienteInteres: input.coeficienteInteres,
        totalSinInteres,
        totalConInteres,
        esSenia: input.esSenia,
        montoSenia: input.esSenia ? input.montoSenia : 0,
        notas: input.notas ?? null,
        saldoPendiente,
        estadoCobro,
        items: {
          create: input.items.map((i, n) => ({
            empresaId,
            productoId: i.productoId,
            varianteId: i.varianteId ?? null,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
            costoUnitario: expandidos[n].costoKit ?? (i.varianteId ? (costoVariante.get(i.varianteId) ?? 0) : (costoProducto.get(i.productoId) ?? 0)),
          })),
        },
      },
      include: { items: { include: { producto: { select: { nombre: true } } } } },
    });

    for (const [n, item] of input.items.entries()) {
      const { salidas, esKit } = expandidos[n];
      for (const salida of salidas) {
        await tx.movimientoInventario.create({
          data: {
            empresaId,
            productoId: salida.productoId,
            varianteId: salida.varianteId,
            loteId: esKit ? null : (item.loteId ?? null),
            usuarioId: input.usuarioId,
            tipo: 'venta',
            cantidad: salida.cantidad,
            signo: -1,
            precioUnitario: esKit ? null : item.precioUnitario,
            ubicacionOrigen: input.ubicacionOrigen ?? null,
            motivo: esKit ? 'Componente de kit' : null,
            referenciaId: venta.id,
          },
        });
      }
    }

    return { ok: true, venta };
}
