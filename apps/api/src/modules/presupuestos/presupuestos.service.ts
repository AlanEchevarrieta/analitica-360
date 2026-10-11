import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException, type OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { CotizacionesService, type MonedaPresupuesto } from '../cotizaciones/cotizaciones.service.js';
import { DocumentosService } from '../documentos/documentos.service.js';
import { TITULO, numeroDocumento } from '../documentos/documentos.util.js';
import { DECIMALES_MONEDA, montosEnMoneda, NOMBRE_MONEDA, SIMBOLO_MONEDA } from './presupuestos.util.js';

export interface ItemPresupuestoInput {
  productoId: string;
  varianteId?: string | null;
  cantidad: number;
  precioUnitario: number;
}

export interface PresupuestoInput {
  clienteId?: string | null;
  clienteNombre?: string | null;
  items: ItemPresupuestoInput[];
  descuento: number;
  notas?: string | null;
  /** AAAA-MM-DD; si no viene, hoy + la validez de la configuración. */
  validoHasta?: string | null;
  /** Moneda en que se le muestra al cliente (los precios van en pesos). */
  moneda?: MonedaPresupuesto;
  /** Pesos por unidad escritos a mano; si no viene, la cotización de hoy. */
  cotizacion?: number | null;
}

export type EstadoPresupuesto = 'pendiente' | 'aceptado' | 'rechazado' | 'vencido';

const fecha = (d: Date) => d.toISOString().slice(0, 10);
const sumarDias = (f: string, n: number) => new Date(Date.parse(`${f}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Un pendiente cuya validez ya pasó se muestra como vencido (no se guarda: se calcula). */
export function estadoVisible(estado: string, validoHasta: string, hoy: string): EstadoPresupuesto {
  return estado === 'pendiente' && validoHasta < hoy ? 'vencido' : (estado as EstadoPresupuesto);
}

type ConItems = Prisma.PresupuestoGetPayload<{ include: { items: true } }>;

/**
 * Presupuestos (plan Pro): cotizaciones a clientes que se mandan en PDF y se
 * pasan a venta con un clic. No apartan stock. Los precios quedan fijos.
 */
@Injectable()
export class PresupuestosService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentos: DocumentosService,
    private readonly cotizaciones: CotizacionesService,
  ) {}

  onModuleInit() {
    this.documentos.registrar('presupuesto', (empresaId, id) => this.datosPdf(empresaId, id));
  }

  private vista(p: ConItems, hoy = fechaHoyAR()) {
    const items = [...p.items].sort((a, b) => a.orden - b.orden).map((i) => ({ id: i.id, productoId: i.productoId, varianteId: i.varianteId, descripcion: i.descripcion, cantidad: i.cantidad, precioUnitario: i.precioUnitario.toNumber() }));
    const subtotal = items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
    const descuento = p.descuento.toNumber();
    const validoHasta = fecha(p.validoHasta);
    const moneda = p.moneda as MonedaPresupuesto;
    const cotizacion = p.cotizacion?.toNumber() ?? null;
    const enMoneda = moneda !== 'ARS' && cotizacion ? montosEnMoneda(items, descuento, moneda, cotizacion) : null;
    return {
      id: p.id,
      numero: numeroDocumento('P', p.numero),
      fecha: p.fecha.toISOString(),
      validoHasta,
      estado: estadoVisible(p.estado, validoHasta, hoy),
      clienteId: p.clienteId,
      clienteNombre: p.clienteNombre,
      items,
      subtotal,
      descuento,
      total: Math.max(0, subtotal - descuento),
      notas: p.notas,
      ventaId: p.ventaId,
      moneda,
      cotizacion,
      cotizacionDe: p.cotizacionDe,
      /** Montos en la moneda del presupuesto (null en pesos). */
      enMoneda: enMoneda && { subtotal: enMoneda.subtotal, descuento: enMoneda.descuento, total: enMoneda.total },
    };
  }

  /** La cotización que queda fija en el presupuesto: la escrita a mano o la de hoy. */
  private async cotizacion(empresaId: string, input: PresupuestoInput, actual?: { moneda: string; cotizacion: Prisma.Decimal | null; cotizacionDe: string | null }) {
    const moneda = input.moneda ?? 'ARS';
    if (moneda === 'ARS') return { moneda, cotizacion: null, cotizacionDe: null };
    if (input.cotizacion != null) {
      // Si es la misma que ya tenía, se mantiene de dónde salió.
      const igual = actual?.moneda === moneda && actual.cotizacion?.toNumber() === input.cotizacion;
      return { moneda, cotizacion: new Prisma.Decimal(input.cotizacion), cotizacionDe: igual ? actual.cotizacionDe : 'Escrita a mano' };
    }
    const hoy = (await this.cotizaciones.monedas(empresaId))[moneda];
    if (!hoy) throw new ServiceUnavailableException(`Todavía no tenemos la cotización en ${NOMBRE_MONEDA[moneda]}. Escribila a mano o probá en un rato.`);
    return { moneda, cotizacion: new Prisma.Decimal(hoy.valor), cotizacionDe: hoy.de };
  }

  async listar(empresaId: string) {
    const filas = await this.prisma.presupuesto.findMany({ where: { empresaId, deletedAt: null }, include: { items: true }, orderBy: { numero: 'desc' }, take: 500 });
    const hoy = fechaHoyAR();
    const ventas = await this.prisma.venta.findMany({ where: { id: { in: filas.map((f) => f.ventaId).filter((v): v is string => Boolean(v)) } }, select: { id: true, numeroVenta: true } });
    return filas.map((f) => {
      const { items, ...resto } = this.vista(f, hoy);
      return { ...resto, productos: items.length, numeroVenta: ventas.find((v) => v.id === f.ventaId)?.numeroVenta ?? null };
    });
  }

  private async buscar(empresaId: string, id: string, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const p = await db.presupuesto.findFirst({ where: { id, empresaId, deletedAt: null }, include: { items: true } });
    if (!p) throw new NotFoundException('Presupuesto no encontrado');
    return p;
  }

  async ficha(empresaId: string, id: string) {
    const p = await this.buscar(empresaId, id);
    const [cliente, venta] = await Promise.all([
      p.clienteId ? this.prisma.cliente.findFirst({ where: { id: p.clienteId, empresaId }, select: { nombre: true, telefono: true, email: true } }) : null,
      p.ventaId ? this.prisma.venta.findFirst({ where: { id: p.ventaId, empresaId }, select: { numeroVenta: true } }) : null,
    ]);
    const vista = this.vista(p);
    const stock = await this.stockDe(empresaId, vista.items);
    return { ...vista, items: vista.items.map((i, n) => ({ ...i, stock: stock[n] })), cliente, numeroVenta: venta?.numeroVenta ?? null };
  }

  /** Stock de hoy de cada renglón, para avisar al pasar a venta si falta algo (null = kit que se arma al vender). */
  private async stockDe(empresaId: string, items: { productoId: string; varianteId: string | null }[]): Promise<(number | null)[]> {
    if (items.length === 0) return [];
    const ids = [...new Set(items.map((i) => i.productoId))];
    const [filas, kits] = await Promise.all([
      this.prisma.movimientoInventario.groupBy({ by: ['productoId', 'varianteId', 'signo'], where: { empresaId, deletedAt: null, productoId: { in: ids } }, _sum: { cantidad: true } }),
      this.prisma.receta.findMany({ where: { empresaId, deletedAt: null, armarAlVender: true, productoId: { in: ids } }, select: { productoId: true, varianteId: true } }),
    ]);
    return items.map((i) => {
      if (kits.some((k) => k.productoId === i.productoId && (k.varianteId === null || k.varianteId === i.varianteId))) return null;
      return filas
        .filter((f) => f.productoId === i.productoId && (i.varianteId ? f.varianteId === i.varianteId : true))
        .reduce((s, f) => s + (f._sum.cantidad?.toNumber() ?? 0) * f.signo, 0);
    });
  }

  /** Valida productos y cliente de esta empresa y arma los renglones con el nombre de hoy. */
  private async renglones(empresaId: string, input: PresupuestoInput) {
    if (input.items.length === 0) throw new BadRequestException('Agregá al menos un producto');
    const productos = await this.prisma.producto.findMany({
      where: { empresaId, id: { in: [...new Set(input.items.map((i) => i.productoId))] }, deletedAt: null },
      select: { id: true, nombre: true, variantes: { select: { id: true, atributos: true } } },
    });
    const renglones = input.items.map((i, orden) => {
      const p = productos.find((x) => x.id === i.productoId);
      if (!p) throw new BadRequestException('Hay un producto que no existe en tu empresa');
      const v = i.varianteId ? p.variantes.find((x) => x.id === i.varianteId) : null;
      if (i.varianteId && !v) throw new BadRequestException(`La variante de ${p.nombre} no existe`);
      const etiqueta = v ? Object.values(v.atributos as Record<string, string>).filter(Boolean).join(' / ') : '';
      return { productoId: p.id, varianteId: v?.id ?? null, descripcion: etiqueta ? `${p.nombre} (${etiqueta})` : p.nombre, cantidad: i.cantidad, precioUnitario: new Prisma.Decimal(i.precioUnitario), orden };
    });
    const subtotal = input.items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
    if (input.descuento > subtotal) throw new BadRequestException('El descuento no puede ser mayor que el subtotal');
    let clienteNombre = input.clienteNombre?.trim() || null;
    if (input.clienteId) {
      const c = await this.prisma.cliente.findFirst({ where: { id: input.clienteId, empresaId, deletedAt: null }, select: { nombre: true } });
      if (!c) throw new BadRequestException('El cliente no existe en tu empresa');
      clienteNombre = c.nombre;
    }
    return { renglones, clienteNombre };
  }

  private async validoHasta(empresaId: string, pedido: string | null | undefined) {
    const hoy = fechaHoyAR();
    if (pedido) {
      if (pedido < hoy) throw new BadRequestException('La fecha de validez no puede ser anterior a hoy');
      return pedido;
    }
    const conf = await this.prisma.documentosConfig.findUnique({ where: { empresaId }, select: { validezPresupuestoDias: true } });
    return sumarDias(hoy, conf?.validezPresupuestoDias ?? 15);
  }

  async crear(empresaId: string, usuarioId: string, input: PresupuestoInput) {
    const { renglones, clienteNombre } = await this.renglones(empresaId, input);
    const validoHasta = await this.validoHasta(empresaId, input.validoHasta);
    const enMoneda = await this.cotizacion(empresaId, input);
    for (let intento = 0; intento < 3; intento++) {
      try {
        const p = await this.prisma.$transaction(async (tx) => {
          const ultimo = await tx.presupuesto.aggregate({ where: { empresaId }, _max: { numero: true } });
          return tx.presupuesto.create({
            data: {
              empresaId, usuarioId, numero: (ultimo._max.numero ?? 0) + 1, clienteId: input.clienteId ?? null, clienteNombre,
              validoHasta: new Date(`${validoHasta}T00:00:00Z`), descuento: new Prisma.Decimal(input.descuento), notas: input.notas?.trim() || null,
              ...enMoneda,
              items: { create: renglones },
            },
            include: { items: true },
          });
        });
        return this.vista(p);
      } catch (e) {
        // Dos presupuestos a la vez con el mismo número: se reintenta con el siguiente.
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
      }
    }
    throw new ConflictException('No se pudo numerar el presupuesto. Probá de nuevo.');
  }

  /** Editar: solo mientras no se aceptó (se puede reabrir uno vencido cambiando la validez). */
  async editar(empresaId: string, id: string, input: PresupuestoInput) {
    const actual = await this.buscar(empresaId, id);
    if (actual.estado === 'aceptado') throw new BadRequestException('El presupuesto ya pasó a venta: no se puede editar');
    const { renglones, clienteNombre } = await this.renglones(empresaId, input);
    // Sin fecha nueva: se mantiene la que tenía si sigue vigente; si venció, se renueva con la validez de la configuración.
    const vigente = fecha(actual.validoHasta);
    const validoHasta = await this.validoHasta(empresaId, input.validoHasta ?? (vigente >= fechaHoyAR() ? vigente : null));
    const enMoneda = await this.cotizacion(empresaId, input, actual);
    const p = await this.prisma.$transaction(async (tx) => {
      await tx.presupuestoItem.deleteMany({ where: { presupuestoId: id } });
      return tx.presupuesto.update({
        where: { id },
        data: { clienteId: input.clienteId ?? null, clienteNombre, validoHasta: new Date(`${validoHasta}T00:00:00Z`), descuento: new Prisma.Decimal(input.descuento), notas: input.notas?.trim() || null, estado: 'pendiente', ...enMoneda, items: { create: renglones } },
        include: { items: true },
      });
    });
    return this.vista(p);
  }

  async cambiarEstado(empresaId: string, id: string, estado: 'pendiente' | 'rechazado') {
    const p = await this.buscar(empresaId, id);
    if (p.estado === 'aceptado') throw new BadRequestException('El presupuesto ya pasó a venta');
    const actualizado = await this.prisma.presupuesto.update({ where: { id }, data: { estado }, include: { items: true } });
    return this.vista(actualizado);
  }

  /** Marca el presupuesto como aceptado con la venta que salió de él (una sola venta por presupuesto). */
  async aceptar(empresaId: string, id: string, ventaId: string) {
    const p = await this.buscar(empresaId, id);
    if (p.ventaId === ventaId) return this.vista(p);
    if (p.estado === 'aceptado') throw new ConflictException('El presupuesto ya pasó a otra venta');
    const venta = await this.prisma.venta.findFirst({ where: { id: ventaId, empresaId, deletedAt: null }, select: { id: true } });
    if (!venta) throw new BadRequestException('La venta no existe en tu empresa');
    try {
      const actualizado = await this.prisma.presupuesto.update({ where: { id }, data: { estado: 'aceptado', ventaId }, include: { items: true } });
      return this.vista(actualizado);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Esa venta ya está asociada a otro presupuesto');
      throw e;
    }
  }

  async borrar(empresaId: string, id: string) {
    const p = await this.buscar(empresaId, id);
    if (p.estado === 'aceptado') throw new BadRequestException('El presupuesto ya pasó a venta: no se puede borrar');
    await this.prisma.presupuesto.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  private async datosPdf(empresaId: string, id: string) {
    const p = await this.ficha(empresaId, id);
    const dmy = (f: string) => f.split('-').reverse().join('/');
    const m = montosEnMoneda(p.items, p.descuento, p.moneda, p.cotizacion);
    const resumen = m.descuento > 0 ? [{ etiqueta: 'Subtotal', monto: m.subtotal }, { etiqueta: 'Descuento', monto: -m.descuento }] : [];
    const otra = p.moneda !== 'ARS' && p.cotizacion != null;
    const pesos = (n: number) => `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return {
      tipo: 'presupuesto' as const,
      titulo: TITULO.presupuesto,
      numero: p.numero,
      fecha: p.fecha,
      extras: [`Válido hasta: ${dmy(p.validoHasta)}`, ...(otra ? [`Cotización: 1 ${SIMBOLO_MONEDA[p.moneda]} = ${pesos(p.cotizacion!)}`] : [])],
      cliente: { nombre: p.cliente?.nombre ?? p.clienteNombre, telefono: p.cliente?.telefono ?? null, email: p.cliente?.email ?? null },
      items: p.items.map((i, n) => ({ descripcion: i.descripcion, cantidad: i.cantidad, precio: m.precios[n] })),
      resumen,
      total: { etiqueta: 'Total', monto: m.total },
      totalNumero: m.total,
      ...(otra ? { simbolo: SIMBOLO_MONEDA[p.moneda], decimales: DECIMALES_MONEDA[p.moneda] } : {}),
      detalles: [
        ...(otra ? [`Equivale a ${pesos(p.total)} (pesos argentinos, ${p.cotizacionDe ?? 'cotización del presupuesto'}).`] : []),
        'Precios sujetos a disponibilidad de stock.',
      ],
      notas: p.notas,
    };
  }
}
