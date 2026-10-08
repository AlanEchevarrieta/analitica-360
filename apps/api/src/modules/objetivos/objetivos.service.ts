import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Objetivo } from '@prisma/client';
import type { UsuarioContext } from '../../common/auth/request-context.types.js';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { dineroDevolucionesPorDia } from '../analytics/devoluciones-dinero.js';
import { diaAR } from '../analytics/fecha-sql.js';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service.js';
import { AccesoCuentaService } from '../planes/acceso-cuenta.service.js';
import type { GuardarObjetivoInput } from './objetivos.dto.js';
import { ACUMULATIVOS, ADJETIVO_PERIODO, evaluar, NOMBRE_TIPO, periodosAnteriores, rangoPeriodo, TEXTO_SEMAFORO, valorObjetivo, type Avance, type PeriodoObjetivo, type Rango, type TipoObjetivo } from './objetivos.util.js';

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
}

type Filtro = { ubicacion: string | null; usuarioId: string | null; productoId: string | null };
type PorDia = Map<string, number>;

const sumar = (m: PorDia, r: Rango) => {
  let t = 0;
  for (const [dia, v] of m) if (dia >= r.desde && dia <= r.hasta) t += v;
  return t;
};

@Injectable()
export class ObjetivosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cotizaciones: CotizacionesService,
    private readonly acceso: AccesoCuentaService,
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
        include: { usuario: { select: { id: true, nombre: true, email: true } }, producto: { select: { id: true, nombre: true } } },
        orderBy: [{ createdAt: 'asc' }],
      }),
      this.avanzados(empresaId),
    ]);
    const visibles = avanzados ? todos : todos.filter((o) => ObjetivosService.esBasico(o));
    return Promise.all(visibles.map((o) => this.conAvance(o, hoy)));
  }

  private async conAvance(
    o: Objetivo & { usuario: { id: string; nombre: string; email: string } | null; producto: { id: string; nombre: string } | null },
    hoy: string,
  ): Promise<ObjetivoConAvance> {
    const tipo = o.tipo as TipoObjetivo;
    const periodo = o.periodo as PeriodoObjetivo;
    const actual = rangoPeriodo(periodo, hoy);
    const previos = periodosAnteriores(periodo, hoy, HISTORIAL).reverse();
    const rangos = [...previos, actual];
    const valores = await this.medir(o.empresaId, tipo, o.moneda as 'ARS' | 'USD', { ubicacion: o.ubicacion, usuarioId: o.usuarioId, productoId: o.productoId }, rangos);
    const meta = Number(o.meta);
    const avances = rangos.map((r, i) => evaluar(tipo, meta, valores[i], r, hoy));
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
    };
  }

  /** Valor del objetivo en cada rango (null = sin datos para medir). */
  async medir(empresaId: string, tipo: TipoObjetivo, moneda: 'ARS' | 'USD', filtro: Filtro, rangos: Rango[]): Promise<(number | null)[]> {
    const desde = rangos[0].desde;
    const hasta = rangos[rangos.length - 1].hasta;
    if (tipo === 'facturacion' || tipo === 'ganancia') {
      const { cobrado, costo } = await this.serieVentas(empresaId, moneda, filtro, desde, hasta);
      return rangos.map((r) => (tipo === 'facturacion' ? sumar(cobrado, r) : sumar(cobrado, r) - sumar(costo, r)));
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
   * menos saldo pendiente). Para toda la empresa también descuenta las devoluciones, igual que
   * Analytics; por sucursal o usuario no, porque una devolución no siempre es de la misma venta.
   */
  private async serieVentas(empresaId: string, moneda: 'ARS' | 'USD', filtro: Filtro, desde: string, hasta: string) {
    const conv = await this.cotizaciones.conversor(empresaId, moneda, desde, hasta);
    const dia = diaAR(Prisma.raw('v.fecha'));
    const f = conv.factor(dia);
    const filas = await this.prisma.$queryRaw<{ dia: string; cobrado: string; costo: string }[]>(Prisma.sql`
      SELECT (${dia})::text AS dia,
        SUM(GREATEST(COALESCE(v.total_con_interes, 0) - COALESCE(v.saldo_pendiente, 0), 0) * ${f}) AS cobrado,
        SUM((
          SELECT COALESCE(SUM(COALESCE(NULLIF(vi.costo_unitario, 0), pr.costo, 0) * vi.cantidad), 0)
          FROM ventas_items vi LEFT JOIN productos pr ON pr.id = vi.producto_id WHERE vi.venta_id = v.id
        ) * ${f}) AS costo
      FROM ventas v
      ${filtro.ubicacion ? Prisma.sql`JOIN LATERAL (
          SELECT m.ubicacion_origen AS ubicacion FROM movimientos_inventario m
          WHERE m.referencia_id = v.id AND m.tipo = 'venta' AND m.signo = -1 AND m.deleted_at IS NULL LIMIT 1
        ) u ON u.ubicacion = ${filtro.ubicacion}` : Prisma.empty}
      WHERE v.empresa_id = ${empresaId}::uuid AND v.deleted_at IS NULL
        AND ${dia} BETWEEN ${desde}::date AND ${hasta}::date
        ${filtro.usuarioId ? Prisma.sql`AND v.usuario_id = ${filtro.usuarioId}::uuid` : Prisma.empty}
      GROUP BY 1`);
    const cobrado: PorDia = new Map(filas.map((x) => [x.dia, Number(x.cobrado)]));
    const costo: PorDia = new Map(filas.map((x) => [x.dia, Number(x.costo)]));
    if (!filtro.ubicacion && !filtro.usuarioId) {
      const devoluciones = await dineroDevolucionesPorDia(this.prisma, empresaId, new Date(`${desde}T00:00:00.000-03:00`), new Date(`${hasta}T23:59:59.999-03:00`), conv);
      for (const d of devoluciones) {
        cobrado.set(d.fecha, (cobrado.get(d.fecha) ?? 0) + d.ingreso);
        costo.set(d.fecha, (costo.get(d.fecha) ?? 0) + d.costo);
      }
    }
    return { cobrado, costo };
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
      ${filtro.ubicacion ? Prisma.sql`JOIN LATERAL (
          SELECT m.ubicacion_origen AS ubicacion FROM movimientos_inventario m
          WHERE m.referencia_id = v.id AND m.tipo = 'venta' AND m.signo = -1 AND m.deleted_at IS NULL LIMIT 1
        ) u ON u.ubicacion = ${filtro.ubicacion}` : Prisma.empty}
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
        return { linea: `${NOMBRE_TIPO[o.tipo]} ${ADJETIVO_PERIODO[o.periodo]} · ${quien}: ${v(o.actual.valor)}, ${de} ${v(o.meta)}${pct} · ${TEXTO_SEMAFORO[o.actual.semaforo]}`, semaforo: o.actual.semaforo };
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
    if (!ubicacion) throw new BadRequestException('Esa sucursal no existe');
    if (!usuarioObj) throw new BadRequestException('Ese usuario no es de la empresa');
    if (!producto) throw new BadRequestException('Ese producto no es de la empresa');
  }

  private datos(input: GuardarObjetivoInput) {
    const conMoneda = input.tipo === 'facturacion' || input.tipo === 'ganancia';
    return {
      tipo: input.tipo,
      periodo: input.periodo,
      meta: new Prisma.Decimal(input.meta),
      moneda: conMoneda ? input.moneda : 'ARS',
      ubicacion: input.ubicacion,
      usuarioId: input.usuarioId,
      productoId: input.tipo === 'produccion' ? input.productoId : null,
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

  async borrar(empresaId: string, usuario: UsuarioContext, id: string) {
    if (usuario.rol !== 'dueno') throw new ForbiddenException('Solo el dueño o un administrador pueden borrar objetivos');
    const r = await this.prisma.objetivo.deleteMany({ where: { id, empresaId } });
    if (r.count === 0) throw new NotFoundException('Objetivo no encontrado');
  }
}
