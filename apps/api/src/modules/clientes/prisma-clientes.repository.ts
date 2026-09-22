import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  AgregarInteraccionInput,
  ClienteFicha,
  ClienteRecord,
  ClienteSegmentoRecord,
  ClientesRepository,
  CumpleProximoRecord,
  DestinatarioDifusion,
  DifusionRecord,
  GuardarClienteInput,
  GuardarDifusionInput,
  InteraccionRecord,
  SegmentosClientes,
  TipoInteraccion,
  VentaResumenCliente,
} from './clientes.repository.js';
import { diasHastaCumple, mesActualMendoza } from './clientes.util.js';

const VENTAS_TOP_VIP = 10;
const UMBRAL_INACTIVO_DIAS = 60;
const UMBRAL_EN_RIESGO_DIAS = 30;
const HORIZONTE_CUMPLE_SEGMENTO = 7;

function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

interface AggVentas {
  ultima: Date;
  total: number;
  cantidad: number;
}

@Injectable()
export class PrismaClientesRepository implements ClientesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async aggregarVentasPorCliente(empresaId: string): Promise<Map<string, AggVentas>> {
    // GROUP BY en Postgres en vez de traer cada Venta de la empresa a
    // memoria para sumarlas en JS - esto se llama en cada GET /clientes y
    // /clientes/segmentos, así que el costo crece con todo el historial de
    // ventas si no se empuja la agregación a la DB.
    const filas = await this.prisma.$queryRaw<
      { cliente_id: string; ultima: Date; total: unknown; cantidad: bigint }[]
    >(Prisma.sql`
      SELECT
        cliente_id,
        MAX(fecha) AS ultima,
        COALESCE(SUM(COALESCE(total_con_interes, total_sin_interes, 0)), 0) AS total,
        COUNT(*) AS cantidad
      FROM ventas
      WHERE empresa_id = ${empresaId}::uuid AND deleted_at IS NULL AND cliente_id IS NOT NULL
      GROUP BY cliente_id
    `);
    const mapa = new Map<string, AggVentas>();
    for (const f of filas) {
      mapa.set(f.cliente_id, { ultima: f.ultima, total: Number(f.total), cantidad: Number(f.cantidad) });
    }
    return mapa;
  }

  async listar(empresaId: string): Promise<ClienteRecord[]> {
    const [clientes, agregados] = await Promise.all([
      this.prisma.cliente.findMany({ where: { empresaId, deletedAt: null }, orderBy: { nombre: 'asc' } }),
      this.aggregarVentasPorCliente(empresaId),
    ]);
    return clientes.map((c) => {
      const agg = agregados.get(c.id);
      return {
        id: c.id,
        empresaId: c.empresaId,
        nombre: c.nombre,
        telefono: c.telefono,
        email: c.email,
        cumpleanos: isoDate(c.cumpleanos),
        notasLibres: c.notasLibres,
        etiquetas: c.etiquetas,
        ultimaCompra: agg ? isoDate(agg.ultima) : null,
        totalGastado: agg?.total ?? 0,
        cantidadCompras: agg?.cantidad ?? 0,
      };
    });
  }

  async ficha(empresaId: string, id: string): Promise<ClienteFicha | null> {
    const cliente = await this.prisma.cliente.findFirst({ where: { id, empresaId, deletedAt: null } });
    if (!cliente) return null;

    const [ventas, interacciones] = await Promise.all([
      this.prisma.venta.findMany({
        where: { empresaId, clienteId: id, deletedAt: null },
        include: { items: { include: { producto: { select: { nombre: true } } } } },
        orderBy: { fecha: 'desc' },
      }),
      this.prisma.clienteInteraccion.findMany({
        where: { empresaId, clienteId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const ventasResumen: VentaResumenCliente[] = ventas.map((v) => {
      const itemsTotal = v.items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario.toNumber(), 0);
      const total = v.totalConInteres?.toNumber() ?? v.totalSinInteres?.toNumber() ?? itemsTotal - v.descuento.toNumber();
      return {
        id: v.id,
        fecha: v.fecha,
        productos: v.items.map((i) => `${i.producto.nombre} × ${i.cantidad}`).join(', '),
        total,
        formaPago: v.formaPago,
      };
    });

    const total = ventasResumen.reduce((acc, v) => acc + v.total, 0);
    const fechas = ventas.map((v) => v.fecha).sort((a, b) => a.getTime() - b.getTime());

    return {
      id: cliente.id,
      empresaId: cliente.empresaId,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email,
      cumpleanos: isoDate(cliente.cumpleanos),
      notasLibres: cliente.notasLibres,
      etiquetas: cliente.etiquetas,
      ultimaCompra: fechas.length > 0 ? isoDate(fechas[fechas.length - 1]) : null,
      totalGastado: total,
      cantidadCompras: ventasResumen.length,
      ventas: ventasResumen,
      interacciones: interacciones.map(
        (i): InteraccionRecord => ({
          id: i.id,
          tipo: i.tipo as TipoInteraccion,
          contenido: i.contenido,
          privado: i.privado,
          createdAt: i.createdAt,
        }),
      ),
    };
  }

  async crear(empresaId: string, input: GuardarClienteInput): Promise<ClienteRecord> {
    const creado = await this.prisma.cliente.create({
      data: {
        empresaId,
        nombre: input.nombre,
        telefono: input.telefono,
        email: input.email,
        cumpleanos: input.cumpleanos,
        notasLibres: input.notasLibres,
        etiquetas: input.etiquetas,
      },
    });
    return {
      id: creado.id,
      empresaId: creado.empresaId,
      nombre: creado.nombre,
      telefono: creado.telefono,
      email: creado.email,
      cumpleanos: isoDate(creado.cumpleanos),
      notasLibres: creado.notasLibres,
      etiquetas: creado.etiquetas,
      ultimaCompra: null,
      totalGastado: 0,
      cantidadCompras: 0,
    };
  }

  async actualizar(empresaId: string, id: string, input: GuardarClienteInput): Promise<ClienteRecord | null> {
    const { count } = await this.prisma.cliente.updateMany({
      where: { id, empresaId },
      data: {
        nombre: input.nombre,
        telefono: input.telefono,
        email: input.email,
        cumpleanos: input.cumpleanos,
        notasLibres: input.notasLibres,
        etiquetas: input.etiquetas,
      },
    });
    if (count === 0) return null;

    const [cliente, ventas] = await Promise.all([
      this.prisma.cliente.findFirst({ where: { id, empresaId } }),
      this.prisma.venta.findMany({
        where: { empresaId, clienteId: id, deletedAt: null },
        select: { fecha: true, totalConInteres: true, totalSinInteres: true },
      }),
    ]);
    if (!cliente) return null;
    const total = ventas.reduce((acc, v) => acc + (v.totalConInteres?.toNumber() ?? v.totalSinInteres?.toNumber() ?? 0), 0);
    const ultima = ventas.reduce<Date | null>((max, v) => (!max || v.fecha > max ? v.fecha : max), null);
    return {
      id: cliente.id,
      empresaId: cliente.empresaId,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email,
      cumpleanos: isoDate(cliente.cumpleanos),
      notasLibres: cliente.notasLibres,
      etiquetas: cliente.etiquetas,
      ultimaCompra: isoDate(ultima),
      totalGastado: total,
      cantidadCompras: ventas.length,
    };
  }

  async agregarInteraccion(empresaId: string, input: AgregarInteraccionInput): Promise<'ok' | 'cliente_invalido'> {
    const cliente = await this.prisma.cliente.findFirst({ where: { id: input.clienteId, empresaId } });
    if (!cliente) return 'cliente_invalido';
    await this.prisma.clienteInteraccion.create({
      data: {
        empresaId,
        clienteId: input.clienteId,
        tipo: input.tipo,
        contenido: input.contenido,
        privado: input.privado,
      },
    });
    return 'ok';
  }

  async segmentos(empresaId: string): Promise<SegmentosClientes> {
    const [clientes, agregados] = await Promise.all([
      this.prisma.cliente.findMany({ where: { empresaId, deletedAt: null } }),
      this.aggregarVentasPorCliente(empresaId),
    ]);
    const hoy = new Date();

    const inactivos: ClienteSegmentoRecord[] = [];
    const enRiesgo: ClienteSegmentoRecord[] = [];
    const cumpleanos: ClienteSegmentoRecord[] = [];
    const conVentas: { cliente: (typeof clientes)[number]; agg: AggVentas }[] = [];

    for (const c of clientes) {
      const agg = agregados.get(c.id);
      if (agg) {
        conVentas.push({ cliente: c, agg });
        const dias = Math.floor((hoy.getTime() - agg.ultima.getTime()) / 86400000);
        const registro: ClienteSegmentoRecord = {
          id: c.id,
          nombre: c.nombre,
          telefono: c.telefono,
          dias,
          ultimaCompra: isoDate(agg.ultima),
          fechaNacimiento: isoDate(c.cumpleanos),
          totalFacturado: agg.total,
          totalCompras: agg.cantidad,
        };
        if (dias > UMBRAL_INACTIVO_DIAS) inactivos.push(registro);
        else if (dias >= UMBRAL_EN_RIESGO_DIAS) enRiesgo.push(registro);
      }
      if (c.cumpleanos) {
        const dias = diasHastaCumple(c.cumpleanos.toISOString(), hoy);
        if (dias != null && dias <= HORIZONTE_CUMPLE_SEGMENTO) {
          cumpleanos.push({
            id: c.id,
            nombre: c.nombre,
            telefono: c.telefono,
            dias,
            ultimaCompra: agg ? isoDate(agg.ultima) : null,
            fechaNacimiento: isoDate(c.cumpleanos),
            totalFacturado: agg?.total ?? null,
            totalCompras: agg?.cantidad ?? null,
          });
        }
      }
    }

    const vip: ClienteSegmentoRecord[] = [...conVentas]
      .sort((a, b) => b.agg.total - a.agg.total)
      .slice(0, VENTAS_TOP_VIP)
      .map(({ cliente: c, agg }) => ({
        id: c.id,
        nombre: c.nombre,
        telefono: c.telefono,
        dias: null,
        ultimaCompra: isoDate(agg.ultima),
        fechaNacimiento: isoDate(c.cumpleanos),
        totalFacturado: agg.total,
        totalCompras: agg.cantidad,
      }));

    inactivos.sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0));
    enRiesgo.sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0));
    cumpleanos.sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0) || a.nombre.localeCompare(b.nombre, 'es'));

    return {
      inactivos,
      enRiesgo,
      cumpleanos,
      vip,
      conteos: { inactivos: inactivos.length, enRiesgo: enRiesgo.length, cumpleanos: cumpleanos.length, vip: vip.length },
    };
  }

  async cumpleanosProximos(empresaId: string, horizonteDias: number): Promise<CumpleProximoRecord[]> {
    const clientes = await this.prisma.cliente.findMany({
      where: { empresaId, deletedAt: null, cumpleanos: { not: null } },
      select: { id: true, nombre: true, telefono: true, cumpleanos: true },
    });
    const hoy = new Date();
    return clientes
      .map((c) => {
        const dias = diasHastaCumple(c.cumpleanos!.toISOString(), hoy);
        if (dias == null || dias > horizonteDias) return null;
        return { id: c.id, nombre: c.nombre, telefono: c.telefono, dias };
      })
      .filter((c): c is CumpleProximoRecord => c != null)
      .sort((a, b) => a.dias - b.dias || a.nombre.localeCompare(b.nombre, 'es'));
  }

  async cumpleanosMes(empresaId: string): Promise<DestinatarioDifusion[]> {
    const clientes = await this.prisma.cliente.findMany({
      where: { empresaId, deletedAt: null, cumpleanos: { not: null } },
      select: { id: true, nombre: true, telefono: true, cumpleanos: true },
    });
    const mes = mesActualMendoza();
    return clientes
      .filter((c) => (c.cumpleanos!.getUTCMonth() + 1) === mes)
      .map((c) => ({ id: c.id, nombre: c.nombre, telefono: c.telefono }));
  }

  async listarDifusiones(empresaId: string): Promise<DifusionRecord[]> {
    const filas = await this.prisma.difusion.findMany({
      where: { empresaId, deletedAt: null },
      orderBy: { fecha: 'desc' },
      take: 50,
    });
    return filas.map((d) => ({ id: d.id, segmento: d.segmento, mensaje: d.mensaje, cantidad: d.cantidadDestinatarios, fecha: d.fecha }));
  }

  async guardarDifusion(empresaId: string, input: GuardarDifusionInput): Promise<DifusionRecord> {
    const creada = await this.prisma.difusion.create({
      data: {
        empresaId,
        usuarioId: input.usuarioId,
        segmento: input.segmento,
        mensaje: input.mensaje,
        cantidadDestinatarios: input.cantidad,
      },
    });
    return {
      id: creada.id,
      segmento: creada.segmento,
      mensaje: creada.mensaje,
      cantidad: creada.cantidadDestinatarios,
      fecha: creada.fecha,
    };
  }
}
