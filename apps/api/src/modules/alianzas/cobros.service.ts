import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { AccesoCuentaService } from '../planes/acceso-cuenta.service.js';
import { MESES_CICLO, PLANES, PLANES_PAGOS, type CicloFacturacion, type PlanPagoId } from '../planes/planes.util.js';
import {
  ajustePorDevolucion,
  comisionDePago,
  cotizarPeriodo,
  finDeComision,
  montosCuotas,
  porcentajePorOrden,
  primerDiaDelMes,
  sumarDias,
  sumarMeses,
  tipoDelProximoPeriodo,
  type Cotizacion,
  type CuotasGenerales,
  type ReglasCupon,
  type TramoComision,
} from './alianzas.util.js';

type Tx = Prisma.TransactionClient;
const fecha = (d: Date | null | undefined) => d?.toISOString().slice(0, 10) ?? null;
const aDate = (f: string) => new Date(`${f}T00:00:00Z`);
const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

export interface PropuestaPago {
  empresaId: string;
  plan: PlanPagoId;
  ciclo: CicloFacturacion;
  cotizacion: Cotizacion;
  cupon: { codigo: string; camara: string | null } | null;
  /** Si se paga en cuotas: número de la próxima cuota y el grupo al que pertenece. */
  cuota: number | null;
  cuotas: number;
  grupoId: string | null;
  /** Lo que cubre y lo que se cobra en este pago (un pago completo o una cuota). */
  periodoDesde: string;
  periodoHasta: string;
  precioLista: number;
  monto: number;
}

export interface RegistrarCobroInput {
  empresaId: string;
  plan: PlanPagoId;
  ciclo: CicloFacturacion;
  metodo: string;
  notas?: string;
  /** Inicio del período (por defecto, cuando termina lo ya pagado o hoy). */
  desde?: string;
  /** Pagar el primer período en cuotas (si las reglas del cupón lo permiten). */
  enCuotas?: boolean;
  /** Para cobrar la siguiente cuota de un período ya empezado. */
  grupoId?: string;
  /** Monto distinto del sugerido (queda registrado como ajuste manual). */
  monto?: number;
  /** Fecha de cobro (por defecto hoy): define el mes de la liquidación. */
  fechaCobro?: string;
  origen?: 'manual' | 'mercadopago';
  referenciaExterna?: string;
}


/** Precio especial acordado con la empresa (ej. cliente piloto), si es para este plan. */
function precioEspecial(empresa: { precioEspecialPlan: string | null; precioEspecialMensual: { toNumber(): number } | null }, plan: string): number | null {
  return empresa.precioEspecialPlan === plan && empresa.precioEspecialMensual ? empresa.precioEspecialMensual.toNumber() : null;
}

@Injectable()
export class CobrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accesoCuenta: AccesoCuentaService,
  ) {}

  /** Períodos ya pagados (un grupo de cuotas cuenta como un período). */
  private async periodosPagados(tx: Tx | PrismaService, empresaId: string) {
    const pagos = await tx.pago.findMany({
      where: { empresaId, estado: 'confirmado', ciclo: { not: null } },
      select: { id: true, ciclo: true, grupoId: true, periodoHasta: true },
      orderBy: { periodoDesde: 'asc' },
    });
    const vistos = new Set<string>();
    const periodos: { ciclo: CicloFacturacion }[] = [];
    for (const p of pagos) {
      const clave = p.grupoId ?? p.id;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      periodos.push({ ciclo: p.ciclo as CicloFacturacion });
    }
    const coberturaHasta = pagos.reduce<string | null>((max, p) => {
      const h = fecha(p.periodoHasta);
      return h && (!max || h > max) ? h : max;
    }, null);
    return { periodos, coberturaHasta };
  }

  /** Cuánto cobrar: el período que sigue (o la cuota que sigue) con las reglas del cupón de la empresa. */
  async proponer(input: Pick<RegistrarCobroInput, 'empresaId' | 'plan' | 'ciclo' | 'desde' | 'enCuotas' | 'grupoId'>, db: Tx | PrismaService = this.prisma): Promise<PropuestaPago> {
    if (!PLANES_PAGOS.includes(input.plan)) throw new BadRequestException('Plan inválido');
    const empresa = await db.empresa.findUnique({ where: { id: input.empresaId }, include: { cupon: { include: { camara: { select: { nombre: true } } } } } });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    const reglas = (empresa.cupon?.reglas ?? {}) as ReglasCupon;
    const cuponInfo = empresa.cupon ? { codigo: empresa.cupon.codigo, camara: empresa.cupon.camara?.nombre ?? null } : null;

    // Cuota siguiente de un período ya empezado: la próxima pendiente del plan de cuotas.
    if (input.grupoId) {
      const proxima = await db.cuotaProgramada.findFirst({ where: { empresaId: input.empresaId, grupoId: input.grupoId, estado: 'pendiente' }, orderBy: { numero: 'asc' } });
      if (!proxima) {
        const existe = await db.cuotaProgramada.count({ where: { empresaId: input.empresaId, grupoId: input.grupoId } });
        throw existe ? new BadRequestException('Ese período ya tiene todas sus cuotas pagas') : new NotFoundException('No encontramos ese período en cuotas');
      }
      const plan = proxima.plan as PlanPagoId;
      const ciclo = proxima.ciclo as CicloFacturacion;
      const generales = await this.cuotasGenerales(db, plan);
      const cotizacion = cotizarPeriodo(plan, ciclo, empresa.cupon ? reglas[ciclo] : null, proxima.tipoPeriodo as 'entrada' | 'renovacion', 1, generales, precioEspecial(empresa, plan));
      return {
        empresaId: input.empresaId, plan, ciclo, cotizacion, cupon: cuponInfo, cuota: proxima.numero, cuotas: proxima.cuotas, grupoId: input.grupoId,
        periodoDesde: fecha(proxima.periodoDesde)!,
        periodoHasta: fecha(proxima.periodoHasta)!,
        precioLista: Number(proxima.precioLista),
        monto: Number(proxima.monto),
      };
    }

    const { periodos, coberturaHasta } = await this.periodosPagados(db, input.empresaId);
    const regla = empresa.cupon ? reglas[input.ciclo] : null;
    const { tipo, indiceRenovacion } = tipoDelProximoPeriodo(periodos, input.ciclo, regla);
    const cotizacion = cotizarPeriodo(input.plan, input.ciclo, regla, tipo, indiceRenovacion, await this.cuotasGenerales(db, input.plan), precioEspecial(empresa, input.plan));
    const hoy = fechaHoyAR();
    const desde = input.desde ?? (coberturaHasta && coberturaHasta > hoy ? coberturaHasta : hoy);
    const cuotas = input.enCuotas && cotizacion.cuotas > 1 ? cotizacion.cuotas : 1;
    const meses = MESES_CICLO[input.ciclo] / cuotas;
    return {
      empresaId: input.empresaId, plan: input.plan, ciclo: input.ciclo, cotizacion, cupon: cuponInfo,
      cuota: cuotas > 1 ? 1 : null, cuotas, grupoId: null,
      periodoDesde: desde,
      periodoHasta: sumarMeses(desde, meses),
      precioLista: montosCuotas(cotizacion.lista, cuotas)[0],
      monto: montosCuotas(cotizacion.total, cuotas)[0],
    };
  }

  /** Cuotas sin interés para quien no tiene código, según el plan (configurables en la consola). */
  async cuotasGenerales(db: Tx | PrismaService, plan: string): Promise<CuotasGenerales> {
    const fila = await db.plan.findFirst({ where: { nombre: plan, activo: true }, select: { cuotasTrimestral: true, cuotasAnual: true }, orderBy: { createdAt: 'asc' } });
    return { trimestral: fila?.cuotasTrimestral ?? 3, anual: fila?.cuotasAnual ?? 3 };
  }

  /** Mes de liquidación: el del cobro, salvo que ese mes ya esté aprobado o pagado (pasa al siguiente abierto). */
  private async mesLiquidable(tx: Tx, camaraId: string, mes: string): Promise<string> {
    let m = mes;
    for (;;) {
      const liq = await tx.liquidacion.findUnique({ where: { camaraId_mes: { camaraId, mes: aDate(m) } }, select: { estado: true } });
      if (!liq || liq.estado === 'pendiente') return m;
      m = sumarMeses(m, 1);
    }
  }

  /**
   * Registra un cobro (pago completo o cuota): guarda lista, descuento y monto,
   * extiende la suscripción y, si el cliente vino por una cámara, le asigna su
   * número de orden (con el primer pago) y genera la línea de comisión.
   */
  async registrar(input: RegistrarCobroInput) {
    if (!input.metodo.trim()) throw new BadRequestException('Indicá el medio de pago');
    const fechaCobro = input.fechaCobro ?? fechaHoyAR();
    const resultado = await this.prisma.$transaction(async (tx) => {
      const p = await this.proponer(input, tx);
      const monto = input.monto ?? p.monto;
      if (!(monto > 0)) throw new BadRequestException('El monto tiene que ser mayor a cero');
      const grupoId = p.cuotas > 1 ? (p.grupoId ?? randomUUID()) : null;
      const empresa = await tx.empresa.findUniqueOrThrow({ where: { id: input.empresaId } });

      // Período nuevo en cuotas: se arma el plan completo (cada cuota con su vencimiento).
      if (grupoId && !p.grupoId) {
        const listas = montosCuotas(p.cotizacion.lista, p.cuotas);
        const montos = montosCuotas(p.cotizacion.total, p.cuotas);
        const meses = MESES_CICLO[p.ciclo] / p.cuotas;
        await tx.cuotaProgramada.createMany({
          data: montos.map((monto, i) => {
            const desde = sumarMeses(p.periodoDesde, meses * i);
            return {
              empresaId: input.empresaId, grupoId, numero: i + 1, cuotas: p.cuotas, plan: p.plan, ciclo: p.ciclo,
              tipoPeriodo: p.cotizacion.tipo, cuponId: empresa.cuponId, monto, precioLista: listas[i],
              periodoDesde: aDate(desde), periodoHasta: aDate(sumarMeses(p.periodoDesde, meses * (i + 1))), vence: aDate(desde),
            };
          }),
        });
      }

      const pago = await tx.pago.create({
        data: {
          empresaId: input.empresaId,
          montoArs: monto,
          metodo: input.metodo.trim(),
          estado: 'confirmado',
          periodo: aDate(primerDiaDelMes(fechaCobro)),
          notas: input.notas?.trim() || null,
          plan: p.plan,
          ciclo: p.ciclo,
          periodoDesde: aDate(p.periodoDesde),
          periodoHasta: aDate(p.periodoHasta),
          cuota: p.cuota,
          cuotas: p.cuotas > 1 ? p.cuotas : null,
          grupoId,
          tipoPeriodo: p.cotizacion.tipo,
          precioLista: p.precioLista,
          descuentoArs: p.precioLista - monto,
          cuponId: empresa.cuponId,
          reglaAplicada: input.monto != null && input.monto !== p.monto ? 'manual' : p.cotizacion.regla,
          origen: input.origen ?? 'manual',
          referenciaExterna: input.referenciaExterna ?? null,
        },
      });

      if (grupoId) {
        await tx.cuotaProgramada.update({ where: { grupoId_numero: { grupoId, numero: p.cuota! } }, data: { estado: 'pagada', pagoId: pago.id } });
      }

      // La suscripción queda activa con el plan pagado hasta el último día cubierto.
      const plan = await tx.plan.findFirst({ where: { nombre: p.plan, activo: true }, select: { id: true } });
      const ultimoDia = aDate(sumarDias(p.periodoHasta, -1));
      const subs = await tx.suscripcion.findMany({ where: { empresaId: input.empresaId }, select: { id: true, fechaVencimiento: true } });
      if (subs.length === 0) {
        await tx.suscripcion.create({ data: { empresaId: input.empresaId, planId: plan?.id ?? null, estado: 'activa', fechaInicio: aDate(p.periodoDesde), fechaVencimiento: ultimoDia } });
      }
      for (const s of subs) {
        const vence = !s.fechaVencimiento || ultimoDia > s.fechaVencimiento ? ultimoDia : s.fechaVencimiento;
        await tx.suscripcion.update({ where: { id: s.id }, data: { estado: 'activa', planId: plan?.id ?? undefined, fechaVencimiento: vence } });
      }
      await tx.empresa.update({ where: { id: input.empresaId }, data: { planActual: p.plan } });

      const comision = empresa.camaraId ? await this.generarComision(tx, empresa.id, empresa.camaraId, pago.id, monto, p.periodoDesde, p.periodoHasta, fechaCobro) : null;
      return { pago: { id: pago.id, monto, precioLista: p.precioLista, descuento: p.precioLista - monto, plan: p.plan, ciclo: p.ciclo, cuota: p.cuota, cuotas: p.cuotas, grupoId, periodoDesde: p.periodoDesde, periodoHasta: p.periodoHasta, tipo: p.cotizacion.tipo }, comision };
    });
    this.accesoCuenta.olvidar(input.empresaId);
    return resultado;
  }

  private async generarComision(tx: Tx, empresaId: string, camaraId: string, pagoId: string, monto: number, desde: string, hasta: string, fechaCobro: string) {
    // Bloquea la cámara: dos primeros pagos a la vez no pueden tomar el mismo número de orden.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM camaras WHERE id = ${camaraId}::uuid FOR UPDATE`);
    const camara = await tx.camara.findUniqueOrThrow({ where: { id: camaraId } });
    let empresa = await tx.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { ordenCamara: true, comisionPct: true, primerPagoEn: true, comisionHasta: true } });

    if (empresa.ordenCamara == null) {
      const { _max } = await tx.empresa.aggregate({ where: { camaraId }, _max: { ordenCamara: true } });
      const orden = (_max.ordenCamara ?? 0) + 1;
      const porcentaje = porcentajePorOrden(camara.tramos as unknown as TramoComision[], orden);
      empresa = await tx.empresa.update({
        where: { id: empresaId },
        data: { ordenCamara: orden, comisionPct: porcentaje, primerPagoEn: aDate(desde), comisionHasta: aDate(finDeComision(desde, camara.mesesComision)) },
        select: { ordenCamara: true, comisionPct: true, primerPagoEn: true, comisionHasta: true },
      });
    }

    const linea = comisionDePago({
      montoCobrado: monto,
      periodoDesde: desde,
      periodoHasta: hasta,
      inicioVentana: fecha(empresa.primerPagoEn)!,
      finVentana: fecha(empresa.comisionHasta)!,
      porcentaje: Number(empresa.comisionPct),
    });
    if (linea.monto <= 0) return null;
    const mes = await this.mesLiquidable(tx, camaraId, primerDiaDelMes(fechaCobro));
    const creada = await tx.comision.create({
      data: {
        camaraId, empresaId, pagoId, tipo: 'pago',
        base: linea.base, proporcion: linea.proporcion, porcentaje: linea.porcentaje, monto: linea.monto,
        periodoDesde: linea.desde ? aDate(linea.desde) : null, periodoHasta: linea.hasta ? aDate(linea.hasta) : null,
        mes: aDate(mes),
      },
    });
    return { id: creada.id, monto: linea.monto, porcentaje: linea.porcentaje, proporcion: linea.proporcion, mes, orden: empresa.ordenCamara };
  }

  /** Devolución de un pago: queda marcado y, si generó comisión, se carga el ajuste en negativo. */
  async devolver(pagoId: string, motivo: string) {
    const hoy = fechaHoyAR();
    const r = await this.prisma.$transaction(async (tx) => {
      const pago = await tx.pago.findUnique({ where: { id: pagoId } });
      if (!pago) throw new NotFoundException('Pago no encontrado');
      if (pago.estado !== 'confirmado') throw new BadRequestException('Ese pago ya está devuelto');
      await tx.pago.update({ where: { id: pagoId }, data: { estado: 'devuelto', devueltoEn: new Date(), devolucionMotivo: motivo.trim() || null } });
      // Si era una cuota, vuelve a quedar pendiente (se puede cobrar de nuevo).
      await tx.cuotaProgramada.updateMany({ where: { pagoId }, data: { estado: 'pendiente', pagoId: null } });
      const original = await tx.comision.findUnique({ where: { pagoId_tipo: { pagoId, tipo: 'pago' } } });
      if (!original) return { pagoId, ajuste: null };
      const ajuste = ajustePorDevolucion({
        base: Number(original.base), proporcion: Number(original.proporcion), porcentaje: Number(original.porcentaje), monto: Number(original.monto),
        desde: fecha(original.periodoDesde), hasta: fecha(original.periodoHasta),
      });
      const mes = await this.mesLiquidable(tx, original.camaraId, primerDiaDelMes(hoy));
      await tx.comision.create({
        data: {
          camaraId: original.camaraId, empresaId: original.empresaId, pagoId, tipo: 'ajuste',
          base: ajuste.base, proporcion: ajuste.proporcion, porcentaje: ajuste.porcentaje, monto: ajuste.monto,
          periodoDesde: original.periodoDesde, periodoHasta: original.periodoHasta, mes: aDate(mes),
        },
      });
      return { pagoId, ajuste: { monto: ajuste.monto, mes } };
    });
    return r;
  }

  /** Tabla de precios para el emprendedor: por plan y ciclo, el primer pago y la renovación (con sus cuotas). */
  async tablaDePrecios(empresaId: string | null, reglas: ReglasCupon | null) {
    const { periodos } = empresaId ? await this.periodosPagados(this.prisma, empresaId) : { periodos: [] };
    const especial = empresaId ? await this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { precioEspecialPlan: true, precioEspecialMensual: true } }) : null;
    return Promise.all(
      PLANES_PAGOS.map(async (plan) => {
        const generales = await this.cuotasGenerales(this.prisma, plan);
        return {
          plan,
          nombre: PLANES[plan].nombre,
          ciclos: (['mensual', 'trimestral', 'anual'] as const).map((ciclo) => {
            const regla = reglas?.[ciclo] ?? null;
            const { tipo, indiceRenovacion } = tipoDelProximoPeriodo(periodos, ciclo, regla);
            const proximo = cotizarPeriodo(plan, ciclo, regla, tipo, indiceRenovacion, generales, especial ? precioEspecial(especial, plan) : null);
            const renovacion = cotizarPeriodo(plan, ciclo, regla, 'renovacion', tipo === 'entrada' ? 1 : indiceRenovacion + 1, generales, especial ? precioEspecial(especial, plan) : null);
            return {
              ciclo,
              meses: MESES_CICLO[ciclo],
              lista: proximo.lista,
              primerPago: proximo,
              renovacion: { total: renovacion.total, descuento: renovacion.descuento, cuotas: renovacion.cuotas, montoCuota: renovacion.montoCuota },
            };
          }),
        };
      }),
    );
  }

  // ---- Cuotas ------------------------------------------------------------

  private cuotaFila(c: { id: string; grupoId: string; numero: number; cuotas: number; plan: string; ciclo: string; monto: Prisma.Decimal; vence: Date; estado: string; periodoDesde: Date; periodoHasta: Date; pagoId: string | null }, hoy: string) {
    const vence = fecha(c.vence)!;
    const vencida = c.estado === 'pendiente' && vence < hoy;
    return {
      id: c.id, grupoId: c.grupoId, numero: c.numero, cuotas: c.cuotas, plan: c.plan, ciclo: c.ciclo, monto: Number(c.monto),
      vence, estado: vencida ? 'vencida' : c.estado, diasAtraso: vencida ? diasEntre(vence, hoy) : 0,
      periodoDesde: fecha(c.periodoDesde)!, periodoHasta: fecha(c.periodoHasta)!, pagoId: c.pagoId,
    };
  }

  /** Planes de cuotas de un cliente (consola): pagadas, pendientes y vencidas. */
  async cuotasDeEmpresa(empresaId: string) {
    const hoy = fechaHoyAR();
    const filas = await this.prisma.cuotaProgramada.findMany({ where: { empresaId }, orderBy: [{ createdAt: 'desc' }, { numero: 'asc' }] });
    const grupos = new Map<string, ReturnType<CobrosService['cuotaFila']>[]>();
    for (const f of filas) grupos.set(f.grupoId, [...(grupos.get(f.grupoId) ?? []), this.cuotaFila(f, hoy)]);
    return [...grupos.entries()].map(([grupoId, cuotas]) => ({
      grupoId,
      plan: cuotas[0].plan,
      ciclo: cuotas[0].ciclo,
      cuotas,
      pagadas: cuotas.filter((c) => c.estado === 'pagada').length,
      total: cuotas.reduce((a, c) => a + c.monto, 0),
    }));
  }

  /** Cuotas vencidas sin pagar de todos los clientes (consola). */
  async cuotasVencidas() {
    const hoy = fechaHoyAR();
    const filas = await this.prisma.cuotaProgramada.findMany({
      where: { estado: 'pendiente', vence: { lt: aDate(hoy) } },
      include: { empresa: { select: { nombre: true } } },
      orderBy: { vence: 'asc' },
    });
    return filas.map((f) => ({ ...this.cuotaFila(f, hoy), empresaId: f.empresaId, empresa: f.empresa.nombre }));
  }

  /** Para el emprendedor: el período en cuotas que está pagando ("vas por la cuota 2 de 3"). */
  async cuotasEnCurso(empresaId: string) {
    const pendiente = await this.prisma.cuotaProgramada.findFirst({ where: { empresaId, estado: 'pendiente' }, orderBy: [{ vence: 'asc' }, { numero: 'asc' }] });
    if (!pendiente) return null;
    const grupo = await this.prisma.cuotaProgramada.findMany({ where: { grupoId: pendiente.grupoId }, orderBy: { numero: 'asc' } });
    return {
      plan: pendiente.plan,
      ciclo: pendiente.ciclo,
      cuotas: pendiente.cuotas,
      pagadas: grupo.filter((c) => c.estado === 'pagada').length,
      montoCuota: Number(grupo[0].monto),
      proxima: { numero: pendiente.numero, monto: Number(pendiente.monto), vence: fecha(pendiente.vence)! },
    };
  }

  /** Cuotas generales por plan (consola). */
  async listarCuotasGenerales() {
    const planes = await this.prisma.plan.findMany({ where: { nombre: { in: PLANES_PAGOS }, activo: true }, orderBy: { precioArs: 'asc' } });
    return planes.map((p) => ({ id: p.id, plan: p.nombre, nombre: PLANES[p.nombre as PlanPagoId]?.nombre ?? p.nombre, trimestral: p.cuotasTrimestral, anual: p.cuotasAnual }));
  }

  async editarCuotasGenerales(id: string, datos: { trimestral?: number; anual?: number }) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    await this.prisma.plan.update({ where: { id }, data: { cuotasTrimestral: datos.trimestral, cuotasAnual: datos.anual } });
    return this.listarCuotasGenerales();
  }
}
