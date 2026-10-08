import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type Objetivo } from '@prisma/client';
import type { Env } from '../../config/env.validation.js';
import type { Conversor } from '../cotizaciones/conversor.js';
import type { UsuarioContext } from '../../common/auth/request-context.types.js';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { dineroDevolucionesPorDia } from '../analytics/devoluciones-dinero.js';
import { diaAR } from '../analytics/fecha-sql.js';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service.js';
import { AccesoCuentaService } from '../planes/acceso-cuenta.service.js';
import type { GuardarObjetivoInput } from './objetivos.dto.js';
import {
  ACUMULATIVOS,
  ADJETIVO_PERIODO,
  CON_PRODUCTO,
  correspondeAviso,
  EN_DINERO,
  evaluar,
  NOMBRE_TIPO,
  periodosAnteriores,
  rangoPeriodo,
  SIN_SUCURSAL,
  TEXTO_SEMAFORO,
  valorObjetivo,
  type Avance,
  type PeriodoObjetivo,
  type Rango,
  type TipoObjetivo,
} from './objetivos.util.js';

/** Períodos cerrados que se muestran en el historial de cada objetivo. */
const HISTORIAL = 6;

export interface ObjetivoConAvance {
  id: string;
  tipo: TipoObjetivo;
  periodo: PeriodoObjetivo;
  meta: number;
  moneda: 'ARS' | 'USD';
  ubicacion: string | null;
  usuario: { id: string; nombre: string } | null;
  producto: { id: string; nombre: string } | null;
  actual: Avance;
  /** Del más viejo al más reciente. */
  historial: Avance[];
  /** Metas propias de algunos períodos (el resto usa la general). */
  metasPeriodo: { desde: string; meta: number }[];
}

const RANGO_SQL = (desde: string, hasta: string) => ({ desde: new Date(`${desde}T00:00:00.000-03:00`), hasta: new Date(`${hasta}T23:59:59.999-03:00`) });
const ubicacionDeVenta = (ubicacion: string) => Prisma.sql`JOIN LATERAL (
          SELECT m.ubicacion_origen AS ubicacion FROM movimientos_inventario m
          WHERE m.referencia_id = v.id AND m.tipo = 'venta' AND m.signo = -1 AND m.deleted_at IS NULL LIMIT 1
        ) u ON u.ubicacion = ${ubicacion}`;

type Filtro = { ubicacion: string | null; usuarioId: string | null; productoId: string | null };
type PorDia = Map<string, number>;

const sumar = (m: PorDia, r: Rango) => {
  let t = 0;
  for (const [dia, v] of m) if (dia >= r.desde && dia <= r.hasta) t += v;
  return t;
};

@Injectable()
export class ObjetivosService {
  private readonly logger = new Logger('Objetivos');

  constructor(
    private readonly prisma: PrismaService,
    private readonly cotizaciones: CotizacionesService,
    private readonly acceso: AccesoCuentaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** En Básico solo hay objetivos de facturación de toda la empresa; el resto, desde Pro. */
  private async avanzados(empresaId: string): Promise<boolean> {
    return (await this.acceso.planDe(empresaId)).funciones.includes('objetivos_avanzados');
  }

  private static esBasico(o: { tipo: string; ubicacion: string | null; usuarioId: string | null; productoId: string | null }) {
    return o.tipo === 'facturacion' && !o.ubicacion && !o.usuarioId && !o.productoId;
  }

  /** Dueño y contador ven todos; los demás, solo los suyos. */
  async listar(empresaId: string, usuario: UsuarioContext, hoy: string = fechaHoyAR()): Promise<ObjetivoConAvance[]> {
    const [todos, avanzados] = await Promise.all([
      this.prisma.objetivo.findMany({
        where: { empresaId, ...(usuario.rol === 'operador' ? { usuarioId: usuario.id } : {}) },
        include: { usuario: { select: { id: true, nombre: true, email: true } }, producto: { select: { id: true, nombre: true } }, metas: { select: { desde: true, meta: true } } },
        orderBy: [{ createdAt: 'asc' }],
      }),
      this.avanzados(empresaId),
    ]);
    const visibles = avanzados ? todos : todos.filter((o) => ObjetivosService.esBasico(o));
    return Promise.all(visibles.map((o) => this.conAvance(o, hoy)));
  }

  private async conAvance(
    o: Objetivo & { usuario: { id: string; nombre: string; email: string } | null; producto: { id: string; nombre: string } | null; metas: { desde: Date; meta: Prisma.Decimal }[] },
    hoy: string,
  ): Promise<ObjetivoConAvance> {
    const tipo = o.tipo as TipoObjetivo;
    const periodo = o.periodo as PeriodoObjetivo;
    const actual = rangoPeriodo(periodo, hoy);
    const previos = periodosAnteriores(periodo, hoy, HISTORIAL).reverse();
    const rangos = [...previos, actual];
    const valores = await this.medir(o.empresaId, tipo, o.moneda as 'ARS' | 'USD', { ubicacion: o.ubicacion, usuarioId: o.usuarioId, productoId: o.productoId }, rangos);
    const meta = Number(o.meta);
    const metasPeriodo = o.metas.map((m) => ({ desde: m.desde.toISOString().slice(0, 10), meta: Number(m.meta) })).sort((a, b) => a.desde.localeCompare(b.desde));
    const propia = new Map(metasPeriodo.map((m) => [m.desde, m.meta]));
    const avances = rangos.map((r, i) => evaluar(tipo, propia.get(r.desde) ?? meta, valores[i], r, hoy));
    return {
      id: o.id,
      tipo,
      periodo,
      meta,
      moneda: o.moneda as 'ARS' | 'USD',
      ubicacion: o.ubicacion,
      usuario: o.usuario ? { id: o.usuario.id, nombre: o.usuario.nombre.trim() || o.usuario.email } : null,
      producto: o.producto,
      actual: avances[avances.length - 1],
      historial: avances.slice(0, -1),
      metasPeriodo,
    };
  }

  /** Valor del objetivo en cada rango (null = sin datos para medir). */
  async medir(empresaId: string, tipo: TipoObjetivo, moneda: 'ARS' | 'USD', filtro: Filtro, rangos: Rango[]): Promise<(number | null)[]> {
    const desde = rangos[0].desde;
    const hasta = rangos[rangos.length - 1].hasta;
    if (tipo === 'facturacion' || tipo === 'ganancia' || tipo === 'ticket_promedio') {
      const { cobrado, costo, bruto, ventas } = await this.serieVentas(empresaId, moneda, filtro, desde, hasta);
      return rangos.map((r) => {
        if (tipo === 'facturacion') return sumar(cobrado, r);
        if (tipo === 'ganancia') return sumar(cobrado, r) - sumar(costo, r);
        const n = sumar(ventas, r);
        return n ? Math.round(sumar(bruto, r) / n) : null;
      });
    }
    if (tipo === 'unidades') {
      const unidades = await this.serieUnidades(empresaId, filtro, desde, hasta);
      return rangos.map((r) => sumar(unidades, r));
    }
    if (tipo === 'clientes_nuevos') {
      const nuevos = await this.serieClientesNuevos(empresaId, filtro, desde, hasta);
      return rangos.map((r) => sumar(nuevos, r));
    }
    if (tipo === 'cobranza') {
      const cobros = await this.serieCobranza(empresaId, moneda, filtro, desde, hasta);
      return rangos.map((r) => sumar(cobros, r));
    }
    if (tipo === 'produccion') {
      const unidades = await this.serieProduccion(empresaId, filtro, desde, hasta);
      return rangos.map((r) => sumar(unidades, r));
    }
    const despachos = await this.despachos(empresaId, filtro, desde, hasta);
    return rangos.map((r) => {
      const del = despachos.filter((d) => d.dia >= r.desde && d.dia <= r.hasta);
      if (tipo === 'despachos') return del.length;
      if (tipo === 'dias_despacho') return del.length ? Math.round((del.reduce((a, d) => a + d.dias, 0) / del.length) * 10) / 10 : null;
      const comprometidos = del.filter((d) => d.comprometida);
      return comprometidos.length ? Math.round((comprometidos.filter((d) => d.dia <= d.comprometida!).length / comprometidos.length) * 1000) / 10 : null;
    });
  }

  /**
   * Cobrado y costo por día, con la misma cuenta que Analytics (cobrado = total con interés
   * menos saldo pendiente), neto de devoluciones. Para toda la empresa, igual que Analytics;
   * por sucursal o usuario, cada devolución cuenta para la sucursal y el vendedor de la venta
   * original (las devoluciones sin venta asociada no cuentan). También devuelve lo cobrado sin
   * devoluciones y la cantidad de ventas, para el ticket promedio.
   */
  private async serieVentas(empresaId: string, moneda: 'ARS' | 'USD', filtro: Filtro, desde: string, hasta: string) {
    const conv = await this.cotizaciones.conversor(empresaId, moneda, desde, hasta);
    const dia = diaAR(Prisma.raw('v.fecha'));
    const f = conv.factor(dia);
    const filas = await this.prisma.$queryRaw<{ dia: string; cobrado: string; costo: string; ventas: bigint }[]>(Prisma.sql`
      SELECT (${dia})::text AS dia, COUNT(*) AS ventas,
        SUM(GREATEST(COALESCE(v.total_con_interes, 0) - COALESCE(v.saldo_pendiente, 0), 0) * ${f}) AS cobrado,
        SUM((
          SELECT COALESCE(SUM(COALESCE(NULLIF(vi.costo_unitario, 0), pr.costo, 0) * vi.cantidad), 0)
          FROM ventas_items vi LEFT JOIN productos pr ON pr.id = vi.producto_id WHERE vi.venta_id = v.id
        ) * ${f}) AS costo
      FROM ventas v
      ${filtro.ubicacion ? ubicacionDeVenta(filtro.ubicacion) : Prisma.empty}
      WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL
        AND ${dia} BETWEEN ${desde}::date AND ${hasta}::date
        ${filtro.usuarioId ? Prisma.sql`AND v.usuario_id = ${filtro.usuarioId}::uuid` : Prisma.empty}
      GROUP BY 1`);
    const cobrado: PorDia = new Map(filas.map((x) => [x.dia, Number(x.cobrado)]));
    const bruto: PorDia = new Map(cobrado);
    const ventas: PorDia = new Map(filas.map((x) => [x.dia, Number(x.ventas)]));
    const costo: PorDia = new Map(filas.map((x) => [x.dia, Number(x.costo)]));
    const r = RANGO_SQL(desde, hasta);
    const devoluciones = filtro.ubicacion || filtro.usuarioId ? await this.devolucionesDeVentas(empresaId, filtro, desde, hasta, conv) : await dineroDevolucionesPorDia(this.prisma, empresaId, r.desde, r.hasta, conv);
    for (const d of devoluciones) {
      cobrado.set(d.fecha, (cobrado.get(d.fecha) ?? 0) + d.ingreso);
      costo.set(d.fecha, (costo.get(d.fecha) ?? 0) + d.costo);
    }
    return { cobrado, costo, bruto, ventas };
  }

  /** Igual que dineroDevolucionesPorDia, pero solo las de ventas de esa sucursal o ese vendedor. */
  private async devolucionesDeVentas(empresaId: string, filtro: Filtro, desde: string, hasta: string, conv: Conversor) {
    const r = RANGO_SQL(desde, hasta);
    const dia = diaAR(Prisma.raw('d.fecha'));
    const f = conv.factor(dia);
    const filas = await this.prisma.$queryRaw<{ fecha: string; ingreso: string; costo: string }[]>(Prisma.sql`
      SELECT (${dia})::text AS fecha,
        SUM(CASE WHEN di.tipo = 'devuelto' THEN -1 ELSE 1 END * di.cantidad * di.precio_unitario * ${f}) AS ingreso,
        SUM(CASE WHEN di.tipo = 'devuelto' THEN -1 ELSE 1 END * di.cantidad * COALESCE(
          CASE WHEN di.tipo = 'devuelto' THEN (
            SELECT NULLIF(vi.costo_unitario, 0) FROM ventas_items vi
            WHERE vi.venta_id = d.venta_id AND vi.producto_id = di.producto_id AND vi.variante_id IS NOT DISTINCT FROM di.variante_id LIMIT 1
          ) END,
          pv.costo, p.costo, 0
        ) * ${f}) AS costo
      FROM devoluciones d
      JOIN ventas v ON v.id = d.venta_id
      ${filtro.ubicacion ? ubicacionDeVenta(filtro.ubicacion) : Prisma.empty}
      JOIN devoluciones_items di ON di.devolucion_id = d.id
      JOIN productos p ON p.id = di.producto_id
      LEFT JOIN producto_variantes pv ON pv.id = di.variante_id
      WHERE d.empresa_id = ${empresaId}::uuid AND d.deleted_at IS NULL AND d.estado <> 'cancelado'
        AND d.fecha >= ${r.desde} AND d.fecha <= ${r.hasta}
        ${filtro.usuarioId ? Prisma.sql`AND v.usuario_id = ${filtro.usuarioId}::uuid` : Prisma.empty}
      GROUP BY 1`);
    return filas.map((x) => ({ fecha: x.fecha, ingreso: Number(x.ingreso), costo: Number(x.costo) }));
  }

  /** Unidades vendidas en el período (sin restar devoluciones). */
  private async serieUnidades(empresaId: string, filtro: Filtro, desde: string, hasta: string): Promise<PorDia> {
    const dia = diaAR(Prisma.raw('v.fecha'));
    const filas = await this.prisma.$queryRaw<{ dia: string; unidades: string }[]>(Prisma.sql`
      SELECT (${dia})::text AS dia, SUM(vi.cantidad) AS unidades
      FROM ventas v
      ${filtro.ubicacion ? ubicacionDeVenta(filtro.ubicacion) : Prisma.empty}
      JOIN ventas_items vi ON vi.venta_id = v.id
      WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL
        AND ${dia} BETWEEN ${desde}::date AND ${hasta}::date
        ${filtro.usuarioId ? Prisma.sql`AND v.usuario_id = ${filtro.usuarioId}::uuid` : Prisma.empty}
        ${filtro.productoId ? Prisma.sql`AND vi.producto_id = ${filtro.productoId}::uuid` : Prisma.empty}
      GROUP BY 1`);
    return new Map(filas.map((x) => [x.dia, Number(x.unidades)]));
  }

  /** Clientes cuya primera compra cae en el período (con el vendedor y la sucursal de esa compra). */
  private async serieClientesNuevos(empresaId: string, filtro: Filtro, desde: string, hasta: string): Promise<PorDia> {
    const dia = diaAR(Prisma.raw('v.fecha'));
    const filas = await this.prisma.$queryRaw<{ dia: string; clientes: bigint }[]>(Prisma.sql`
      WITH primeras AS (
        SELECT DISTINCT ON (cliente_id) id, fecha, usuario_id
        FROM ventas
        WHERE empresa_id = ${empresaId}::uuid AND deleted_at IS NULL AND cliente_id IS NOT NULL
        ORDER BY cliente_id, fecha
      )
      SELECT (${dia})::text AS dia, COUNT(*) AS clientes
      FROM primeras v
      ${filtro.ubicacion ? ubicacionDeVenta(filtro.ubicacion) : Prisma.empty}
      WHERE ${dia} BETWEEN ${desde}::date AND ${hasta}::date
        ${filtro.usuarioId ? Prisma.sql`AND v.usuario_id = ${filtro.usuarioId}::uuid` : Prisma.empty}
      GROUP BY 1`);
    return new Map(filas.map((x) => [x.dia, Number(x.clientes)]));
  }

  /** Cobros de cuenta corriente (no anulados), con el dólar de cada día si se pide en dólares. */
  private async serieCobranza(empresaId: string, moneda: 'ARS' | 'USD', filtro: Filtro, desde: string, hasta: string): Promise<PorDia> {
    const conv = await this.cotizaciones.conversor(empresaId, moneda, desde, hasta);
    const dia = diaAR(Prisma.raw('c.fecha'));
    const filas = await this.prisma.$queryRaw<{ dia: string; monto: string }[]>(Prisma.sql`
      SELECT (${dia})::text AS dia, SUM(c.monto * ${conv.factor(dia)}) AS monto
      FROM cobros_clientes c
      WHERE c.empresa_id = ${empresaId}::uuid AND c.anulado_at IS NULL
        AND ${dia} BETWEEN ${desde}::date AND ${hasta}::date
        ${filtro.usuarioId ? Prisma.sql`AND c.usuario_id = ${filtro.usuarioId}::uuid` : Prisma.empty}
      GROUP BY 1`);
    return new Map(filas.map((x) => [x.dia, Number(x.monto)]));
  }

  private async serieProduccion(empresaId: string, filtro: Filtro, desde: string, hasta: string): Promise<PorDia> {
    const dia = diaAR(Prisma.raw('op.fecha'));
    const filas = await this.prisma.$queryRaw<{ dia: string; unidades: string }[]>(Prisma.sql`
      SELECT (${dia})::text AS dia, SUM(op.cantidad) AS unidades
      FROM ordenes_produccion op
      WHERE op.empresa_id = ${empresaId}::uuid AND op.anulada_at IS NULL
        AND ${dia} BETWEEN ${desde}::date AND ${hasta}::date
        ${filtro.usuarioId ? Prisma.sql`AND op.usuario_id = ${filtro.usuarioId}::uuid` : Prisma.empty}
        ${filtro.ubicacion ? Prisma.sql`AND op.ubicacion = ${filtro.ubicacion}` : Prisma.empty}
        ${filtro.productoId ? Prisma.sql`AND op.producto_id = ${filtro.productoId}::uuid` : Prisma.empty}
      GROUP BY 1`);
    return new Map(filas.map((x) => [x.dia, Number(x.unidades)]));
  }

  /** Pedidos despachados: el despacho es la venta que se genera al despachar (quién y de dónde). */
  private async despachos(empresaId: string, filtro: Filtro, desde: string, hasta: string) {
    const dia = diaAR(Prisma.raw('v.fecha'));
    const filas = await this.prisma.$queryRaw<{ dia: string; dias: string; comprometida: string | null }[]>(Prisma.sql`
      SELECT (${dia})::text AS dia,
        EXTRACT(EPOCH FROM (v.fecha - p.created_at)) / 86400.0 AS dias,
        p.fecha_comprometida::text AS comprometida
      FROM pedidos p
      JOIN ventas v ON v.id = p.venta_id AND v.deleted_at IS NULL
      ${filtro.ubicacion ? ubicacionDeVenta(filtro.ubicacion) : Prisma.empty}
      WHERE p.empresa_id = ${empresaId}::uuid AND p.estado <> 'cancelado'
        AND ${dia} BETWEEN ${desde}::date AND ${hasta}::date
        ${filtro.usuarioId ? Prisma.sql`AND v.usuario_id = ${filtro.usuarioId}::uuid` : Prisma.empty}`);
    return filas.map((x) => ({ dia: x.dia, dias: Math.max(0, Number(x.dias)), comprometida: x.comprometida }));
  }

  /** Para el informe por email (lo reciben los dueños): una línea por objetivo, los que peor van primero. */
  async paraInforme(empresaId: string, hoy: string = fechaHoyAR()): Promise<{ linea: string; semaforo: Avance['semaforo'] }[]> {
    const lista = await this.listar(empresaId, { id: '', clerkUserId: '', empresaId, email: '', rol: 'dueno' }, hoy);
    const orden = { mal: 0, justo: 1, bien: 2, sin_datos: 3 };
    return lista
      .sort((a, b) => orden[a.actual.semaforo] - orden[b.actual.semaforo])
      .slice(0, 8)
      .map((o) => {
        const quien = o.usuario?.nombre ?? o.ubicacion ?? 'Toda la empresa';
        const v = (x: number | null) => valorObjetivo(o.tipo, o.moneda, x);
        const pct = o.actual.porcentaje != null && ACUMULATIVOS.includes(o.tipo) ? ` (${o.actual.porcentaje.toLocaleString('es-AR')} %)` : '';
        const de = o.tipo === 'dias_despacho' ? 'máximo' : 'meta';
        return { linea: `${NOMBRE_TIPO[o.tipo]} ${ADJETIVO_PERIODO[o.periodo]} · ${quien}: ${v(o.actual.valor)}, ${de} ${v(o.actual.meta)}${pct} · ${TEXTO_SEMAFORO[o.actual.semaforo]}`, semaforo: o.actual.semaforo };
      });
  }

  /** Para el formulario: sucursales, usuarios y productos de la empresa. */
  async opciones(empresaId: string) {
    const [ubicaciones, usuarios, productos, avanzados] = await Promise.all([
      this.prisma.ubicacion.findMany({ where: { empresaId, activo: true }, select: { nombre: true }, orderBy: { nombre: 'asc' } }),
      this.prisma.usuario.findMany({ where: { empresaId, activo: true }, select: { id: true, nombre: true, email: true }, orderBy: { nombre: 'asc' } }),
      this.prisma.producto.findMany({ where: { empresaId, deletedAt: null, activo: true, esInsumo: false }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' }, take: 1000 }),
      this.avanzados(empresaId),
    ]);
    return {
      avanzados,
      ubicaciones: ubicaciones.map((u) => u.nombre),
      usuarios: usuarios.map((u) => ({ id: u.id, nombre: u.nombre.trim() || u.email })),
      productos,
    };
  }

  private async validar(empresaId: string, usuario: UsuarioContext, input: GuardarObjetivoInput) {
    if (usuario.rol !== 'dueno') throw new ForbiddenException('Solo el dueño o un administrador pueden definir objetivos');
    if (!ObjetivosService.esBasico(input) && !(await this.avanzados(empresaId))) {
      throw new ForbiddenException({ statusCode: 403, code: 'plan_insuficiente', funcion: 'objetivos_avanzados', planMinimo: 'pro', message: 'Los objetivos de ganancia, producción, pedidos y por sucursal o usuario están disponibles desde el plan Pro.' });
    }
    const [ubicacion, usuarioObj, producto] = await Promise.all([
      input.ubicacion ? this.prisma.ubicacion.findFirst({ where: { empresaId, nombre: input.ubicacion } }) : true,
      input.usuarioId ? this.prisma.usuario.findFirst({ where: { empresaId, id: input.usuarioId } }) : true,
      input.productoId ? this.prisma.producto.findFirst({ where: { empresaId, id: input.productoId } }) : true,
    ]);
    if (input.ubicacion && SIN_SUCURSAL.includes(input.tipo)) throw new BadRequestException('La cobranza no se puede medir por sucursal: se mide por toda la empresa o por usuario');
    if (!ubicacion) throw new BadRequestException('Esa sucursal no existe');
    if (!usuarioObj) throw new BadRequestException('Ese usuario no es de la empresa');
    if (!producto) throw new BadRequestException('Ese producto no es de la empresa');
  }

  private datos(input: GuardarObjetivoInput) {
    const conMoneda = EN_DINERO.includes(input.tipo);
    return {
      tipo: input.tipo,
      periodo: input.periodo,
      meta: new Prisma.Decimal(input.meta),
      moneda: conMoneda ? input.moneda : 'ARS',
      ubicacion: input.ubicacion,
      usuarioId: input.usuarioId,
      productoId: CON_PRODUCTO.includes(input.tipo) ? input.productoId : null,
    };
  }

  async crear(empresaId: string, usuario: UsuarioContext, input: GuardarObjetivoInput) {
    await this.validar(empresaId, usuario, input);
    const o = await this.prisma.objetivo.create({ data: { empresaId, creadoPor: usuario.id, ...this.datos(input) } });
    return { id: o.id };
  }

  async actualizar(empresaId: string, usuario: UsuarioContext, id: string, input: GuardarObjetivoInput) {
    await this.validar(empresaId, usuario, input);
    const r = await this.prisma.objetivo.updateMany({ where: { id, empresaId }, data: this.datos(input) });
    if (r.count === 0) throw new NotFoundException('Objetivo no encontrado');
    return { id };
  }

  /** Meta propia de un período (null la saca y vuelve a regir la general). `desde` = primer día del período. */
  async fijarMetaPeriodo(empresaId: string, usuario: UsuarioContext, id: string, desde: string, meta: number | null) {
    if (usuario.rol !== 'dueno') throw new ForbiddenException('Solo el dueño o un administrador pueden cambiar metas');
    const o = await this.prisma.objetivo.findFirst({ where: { id, empresaId }, select: { periodo: true, tipo: true } });
    if (!o) throw new NotFoundException('Objetivo no encontrado');
    if (rangoPeriodo(o.periodo as PeriodoObjetivo, desde).desde !== desde) throw new BadRequestException('Esa fecha no es el comienzo de un período de este objetivo');
    if (o.tipo === 'a_tiempo' && meta != null && meta > 100) throw new BadRequestException('El porcentaje no puede pasar de 100');
    const fecha = new Date(`${desde}T00:00:00.000Z`);
    if (meta == null) {
      await this.prisma.objetivoMeta.deleteMany({ where: { objetivoId: id, desde: fecha } });
    } else {
      await this.prisma.objetivoMeta.upsert({
        where: { objetivoId_desde: { objetivoId: id, desde: fecha } },
        create: { objetivoId: id, desde: fecha, meta: new Prisma.Decimal(meta) },
        update: { meta: new Prisma.Decimal(meta) },
      });
    }
  }

  /** Avisos sin leer del usuario (objetivos que a este ritmo no llegan). */
  async avisos(empresaId: string, usuario: UsuarioContext) {
    const filas = await this.prisma.objetivoAviso.findMany({
      where: { empresaId, usuarioId: usuario.id, leidoEn: null },
      orderBy: { creadoEn: 'desc' },
      take: 20,
      select: { id: true, objetivoId: true, mensaje: true, creadoEn: true },
    });
    return filas;
  }

  async marcarAvisoLeido(empresaId: string, usuario: UsuarioContext, id: string) {
    await this.prisma.objetivoAviso.updateMany({ where: { id, empresaId, usuarioId: usuario.id, leidoEn: null }, data: { leidoEn: new Date() } });
  }

  /**
   * Revisa los objetivos de todas las empresas y avisa (una vez por objetivo, período y persona)
   * a los dueños y al responsable cuando, pasado un cuarto del período, a este ritmo no llegan.
   */
  async revisarAvisos(hoy: string = fechaHoyAR()): Promise<number> {
    const empresas = await this.prisma.objetivo.findMany({ distinct: ['empresaId'], select: { empresaId: true } });
    let nuevos = 0;
    for (const { empresaId } of empresas) {
      try {
        if (!(await this.acceso.planDe(empresaId)).funciones.includes('objetivos')) continue;
        const [lista, duenos] = await Promise.all([
          this.listar(empresaId, { id: '', clerkUserId: '', empresaId, email: '', rol: 'dueno' }, hoy),
          this.prisma.usuario.findMany({ where: { empresaId, activo: true, rolCrudo: { in: ['dueno', 'administrador'] } }, select: { id: true, email: true } }),
        ]);
        for (const o of lista) {
          if (!correspondeAviso(o.tipo, o.actual, hoy)) continue;
          const quien = o.usuario?.nombre ?? o.ubicacion ?? 'toda la empresa';
          const v = (x: number | null) => valorObjetivo(o.tipo, o.moneda, x);
          const mensaje = `${NOMBRE_TIPO[o.tipo]} ${ADJETIVO_PERIODO[o.periodo]} (${quien}): vas ${v(o.actual.valor)} de ${v(o.actual.meta)}. A este ritmo cerrás en ${v(o.actual.proyeccion)}, el ${Math.round(((o.actual.proyeccion ?? 0) / o.actual.meta) * 100)} % de la meta.`;
          const destinatarios = new Map(duenos.map((d) => [d.id, d.email]));
          if (o.usuario && !destinatarios.has(o.usuario.id)) {
            const resp = await this.prisma.usuario.findFirst({ where: { id: o.usuario.id, activo: true }, select: { email: true } });
            if (resp) destinatarios.set(o.usuario.id, resp.email);
          }
          for (const [usuarioId, email] of destinatarios) {
            try {
              await this.prisma.objetivoAviso.create({ data: { empresaId, objetivoId: o.id, desde: new Date(`${o.actual.desde}T00:00:00.000Z`), usuarioId, mensaje } });
            } catch (e) {
              if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue; // ya se avisó en este período
              throw e;
            }
            nuevos++;
            await this.enviarEmail(email, mensaje);
          }
        }
      } catch (e) {
        this.logger.error(`Avisos de objetivos de ${empresaId}: ${(e as Error).message}`);
      }
    }
    return nuevos;
  }

  private async enviarEmail(para: string, mensaje: string) {
    const clave = this.config.get('RESEND_API_KEY', { infer: true });
    if (!clave || !para) return;
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.config.get('AVISOS_EMAIL_DESDE', { infer: true }),
          to: [para],
          subject: 'Analítica 360: un objetivo no llega a este ritmo',
          text: `${mensaje}\n\nLo ves en la app, en Objetivos.`,
        }),
      });
      if (!r.ok) this.logger.warn(`Resend respondió ${r.status}`);
    } catch (e) {
      this.logger.warn(`No se pudo mandar el aviso de objetivo: ${String(e)}`);
    }
  }

  async borrar(empresaId: string, usuario: UsuarioContext, id: string) {
    if (usuario.rol !== 'dueno') throw new ForbiddenException('Solo el dueño o un administrador pueden borrar objetivos');
    const r = await this.prisma.objetivo.deleteMany({ where: { id, empresaId } });
    if (r.count === 0) throw new NotFoundException('Objetivo no encontrado');
  }
}
