import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { diaAR } from '../analytics/fecha-sql.js';
import { perdidasPorDia } from '../inventario/perdidas.sql.js';
import { expandirRecurrentes } from './contabilidad.util.js';
import { ESTADOS_CONTABLES_REPOSITORY, type EstadosContablesRepository } from './estados-contables.repository.js';
import { amortizacionAcumulada, sumarDias } from './estados-contables.util.js';
import { GASTO_REPOSITORY, type GastoRepository } from './gasto.repository.js';
import { asientos, mayor, nombreCuenta, type Cuenta, type DatosDiario } from './libro-diario.util.js';

const CATEGORIAS: Record<string, string> = {
  alquiler: 'Alquiler',
  sueldos: 'Sueldos',
  servicios: 'Servicios',
  marketing: 'Marketing',
  logistica: 'Logística',
  impuestos: 'Impuestos',
  mantenimiento: 'Mantenimiento',
  otro: 'Otros gastos',
};

/** Último día de cada mes que cae dentro de [desde, hasta] (y `hasta` si el mes no terminó). */
function cierresDeMes(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let [y, m] = desde.split('-').map(Number);
  for (;;) {
    const fin = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    out.push(fin < hasta ? fin : hasta);
    if (fin >= hasta) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

@Injectable()
export class LibroDiarioService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ESTADOS_CONTABLES_REPOSITORY) private readonly estados: EstadosContablesRepository,
    @Inject(GASTO_REPOSITORY) private readonly gastoRepository: GastoRepository,
  ) {}

  async libro(empresaId: string, desde: string, hastaPedido: string) {
    const hoy = fechaHoyAR();
    const hasta = hastaPedido > hoy ? hoy : hastaPedido;
    if (desde > hasta) throw new BadRequestException('El período empieza después de hoy');
    const inicio = new Date(`${desde}T03:00:00Z`);
    const fin = new Date(`${sumarDias(hasta, 1)}T03:00:00Z`);
    const dia = (col: string) => diaAR(Prisma.raw(col));

    const [ventas, cobros, sinDetalle, devoluciones, compras, gastos, movimientos, perdidas, movsAmort] = await Promise.all([
      this.prisma.$queryRaw<{ fecha: string; cantidad: bigint; total: string; cobrado: string; costo: string }[]>(Prisma.sql`
        SELECT ${dia('v.fecha')}::text AS fecha, COUNT(*) AS cantidad,
               SUM(COALESCE(v.total_con_interes, 0)) AS total,
               SUM(CASE WHEN v.es_senia THEN v.monto_senia ELSE COALESCE(v.total_con_interes, 0) END) AS cobrado,
               SUM(COALESCE((SELECT SUM(i.cantidad * i.costo_unitario) FROM ventas_items i WHERE i.venta_id = v.id), 0)) AS costo
        FROM ventas v
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL AND v.fecha >= ${inicio} AND v.fecha < ${fin}
        GROUP BY 1`),
      this.prisma.$queryRaw<{ fecha: string; monto: string; detalle: string }[]>(Prisma.sql`
        SELECT ${dia('c.fecha')}::text AS fecha, SUM(a.monto) AS monto,
               COALESCE(cl.nombre, 'sin cliente') || ' · ' || string_agg(COALESCE(v.numero_venta, ''), ', ') AS detalle
        FROM cobros_clientes c
        JOIN cobros_aplicaciones a ON a.cobro_id = c.id
        JOIN ventas v ON v.id = a.venta_id AND v.deleted_at IS NULL
        LEFT JOIN clientes cl ON cl.id = c.cliente_id
        WHERE c.empresa_id = ${empresaId}::uuid AND c.anulado_at IS NULL AND c.fecha >= ${inicio} AND c.fecha < ${fin}
        GROUP BY c.id, 1, cl.nombre`),
      // Saldos de señas cobrados antes de que existiera el registro de cada pago.
      this.prisma.$queryRaw<{ fecha: string; monto: string; detalle: string }[]>(Prisma.sql`
        SELECT ${dia('COALESCE(v.fecha_cobro_saldo, v.fecha)')}::text AS fecha,
               COALESCE(v.total_con_interes, 0) - v.monto_senia - v.saldo_pendiente
                 - COALESCE((SELECT SUM(a.monto) FROM cobros_aplicaciones a JOIN cobros_clientes c ON c.id = a.cobro_id AND c.anulado_at IS NULL WHERE a.venta_id = v.id), 0) AS monto,
               COALESCE(NULLIF(v.cliente_nombre, ''), 'sin cliente') || ' · ' || COALESCE(v.numero_venta, '') AS detalle
        FROM ventas v
        WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL AND v.es_senia
          AND COALESCE(v.fecha_cobro_saldo, v.fecha) >= ${inicio} AND COALESCE(v.fecha_cobro_saldo, v.fecha) < ${fin}`),
      this.estados.devolucionesPorDia(empresaId, hasta),
      this.prisma.compra.findMany({
        where: { empresaId, deletedAt: null, fecha: { gte: new Date(desde), lte: new Date(hasta) } },
        select: { fecha: true, totalReal: true, total: true, aCredito: true, proveedorNombre: true, proveedor: { select: { nombre: true } } },
      }),
      this.gastoRepository.listar(empresaId, '2000-01-01', hasta),
      this.estados.listarMovimientos(empresaId, desde, hasta),
      perdidasPorDia(this.prisma, empresaId, desde, hasta),
      this.estados.movimientosDatos(empresaId, hasta),
    ]);

    const enRango = (f: string) => f >= desde && f <= hasta;
    const datos: DatosDiario = {
      ventas: ventas.map((v) => ({ fecha: v.fecha, cantidad: Number(v.cantidad), total: Number(v.total), cobrado: Number(v.cobrado), costo: Number(v.costo) })),
      cobros: [...cobros, ...sinDetalle.filter((s) => Number(s.monto) > 0.004).map((s) => ({ ...s, detalle: `${s.detalle} (sin detalle)` }))].map((c) => ({ fecha: c.fecha, monto: Number(c.monto), detalle: c.detalle })),
      devoluciones: devoluciones.filter((x) => enRango(x.fecha)).map((x) => ({ fecha: x.fecha, ingreso: x.ingreso, costo: x.costo })),
      compras: compras.map((c) => ({
        fecha: c.fecha.toISOString().slice(0, 10),
        monto: c.totalReal.toNumber() || (c.total?.toNumber() ?? 0),
        aCredito: c.aCredito,
        proveedor: c.proveedor?.nombre ?? c.proveedorNombre ?? 'proveedor',
      })),
      gastos: expandirRecurrentes(gastos, hasta)
        .filter((g) => enRango(g.fecha))
        .map((g) => ({ fecha: g.fecha, monto: g.monto, categoria: g.categoria, descripcion: g.descripcion || null })),
      movimientos: movimientos.filter((m) => m.tipo !== 'arqueo').map((m) => ({ fecha: m.fecha, tipo: m.tipo, monto: m.monto, conCaja: m.conCaja, descripcion: m.descripcion || m.proveedorNombre || null })),
      perdidas,
      amortizaciones: cierresDeMes(desde, hasta).map((cierre, i, todos) => {
        const anterior = i === 0 ? sumarDias(desde, -1) : todos[i - 1];
        return { fecha: cierre, monto: Math.round((amortizacionAcumulada(movsAmort, cierre) - amortizacionAcumulada(movsAmort, anterior)) * 100) / 100 };
      }),
    };

    const lista = asientos(datos);
    const nombre = (c: Cuenta) => nombreCuenta(c, CATEGORIAS);
    return {
      desde,
      hasta,
      asientos: lista.map((a, i) => ({ numero: i + 1, fecha: a.fecha, concepto: a.concepto, origen: a.origen, lineas: a.lineas.map((l) => ({ ...l, nombre: nombre(l.cuenta) })) })),
      mayor: mayor(lista).map((m) => ({ ...m, nombre: nombre(m.cuenta) })),
      totales: {
        debe: Math.round(lista.reduce((s, a) => s + a.lineas.reduce((x, l) => x + l.debe, 0), 0) * 100) / 100,
        haber: Math.round(lista.reduce((s, a) => s + a.lineas.reduce((x, l) => x + l.haber, 0), 0) * 100) / 100,
      },
    };
  }
}
