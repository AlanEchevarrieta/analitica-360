import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import {
  DIAS_GRACIA_CLIENTE,
  estadoCliente,
  mesesEntre,
  mesesRestantesDeComision,
  normalizarCodigo,
  primerDiaDelMes,
  sumarDias,
  sumarMeses,
  tramoActual,
  type EstadoCliente,
  type ReglasCupon,
  type TramoComision,
} from './alianzas.util.js';
import type { CamaraDto, CuponDto, OrigenDto } from './alianzas.dto.js';

const fecha = (d: Date | null | undefined) => d?.toISOString().slice(0, 10) ?? null;
const aDate = (f: string) => new Date(`${f}T00:00:00Z`);
const num = (d: Prisma.Decimal | number | null | undefined) => (d == null ? 0 : Number(d));

export interface ClienteCamara {
  empresaId: string;
  empresa: string;
  plan: string;
  estado: EstadoCliente;
  orden: number | null;
  porcentaje: number | null;
  alta: string;
  pruebaHasta: string | null;
  primerPago: string | null;
  mesesConNosotros: number | null;
  mesesComisionRestantes: number | null;
  comisionHasta: string | null;
  comisionTotal: number;
  facturadoTotal: number;
  codigo: string | null;
  /** Hasta cuándo cubre lo que pagó (excluido). */
  coberturaHasta: string | null;
}

@Injectable()
export class AlianzasAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Cámaras -----------------------------------------------------------

  async listarCamaras() {
    const hoy = fechaHoyAR();
    const camaras = await this.prisma.camara.findMany({ orderBy: { nombre: 'asc' }, include: { cupones: { select: { codigo: true, activo: true } } } });
    return Promise.all(
      camaras.map(async (c) => {
        const clientes = await this.clientesDe(c.id, hoy);
        const pagan = clientes.filter((x) => x.primerPago).length;
        return {
          id: c.id,
          nombre: c.nombre,
          activa: c.activa,
          codigos: c.cupones.map((k) => ({ codigo: k.codigo, activo: k.activo })),
          registros: clientes.length,
          pagan,
          activos: clientes.filter((x) => x.estado === 'activo').length,
          conversion: clientes.length ? pagan / clientes.length : null,
          comisionTotal: clientes.reduce((a, x) => a + x.comisionTotal, 0),
        };
      }),
    );
  }

  async crearCamara(dto: CamaraDto) {
    return this.prisma.camara.create({ data: { ...this.datosCamara(dto), tramos: dto.tramos as unknown as Prisma.InputJsonValue } });
  }

  async editarCamara(id: string, dto: Partial<CamaraDto>) {
    await this.existeCamara(id);
    return this.prisma.camara.update({ where: { id }, data: { ...this.datosCamara(dto), ...(dto.tramos ? { tramos: dto.tramos as unknown as Prisma.InputJsonValue } : {}) } });
  }

  private datosCamara(dto: Partial<CamaraDto>): Omit<Prisma.CamaraUncheckedCreateInput, 'tramos'> & { nombre: string } {
    return {
      nombre: dto.nombre as string,
      contactoNombre: dto.contactoNombre,
      contactoEmail: dto.contactoEmail,
      contactoTelefono: dto.contactoTelefono,
      activa: dto.activa,
      mesesComision: dto.mesesComision,
      notas: dto.notas,
    };
  }

  private async existeCamara(id: string) {
    const c = await this.prisma.camara.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Cámara no encontrada');
    return c;
  }

  /** Clientes de la cámara con su estado, plazo de comisión y lo generado. */
  private async clientesDe(camaraId: string, hoy: string): Promise<ClienteCamara[]> {
    const empresas = await this.prisma.empresa.findMany({
      where: { camaraId, deletedAt: null },
      include: {
        cupon: { select: { codigo: true } },
        pagos: { where: { estado: 'confirmado' }, select: { montoArs: true, periodoHasta: true } },
        comisiones: { select: { monto: true } },
      },
      orderBy: [{ ordenCamara: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    });
    return empresas.map((e) => {
      const coberturaHasta = e.pagos.reduce<string | null>((max, p) => {
        const h = fecha(p.periodoHasta);
        return h && (!max || h > max) ? h : max;
      }, null);
      const primerPago = fecha(e.primerPagoEn);
      const comisionHasta = fecha(e.comisionHasta);
      return {
        empresaId: e.id,
        empresa: e.nombre,
        plan: e.planActual,
        estado: estadoCliente({ primerPagoEn: primerPago, pruebaHasta: fecha(e.pruebaHasta), coberturaHasta }, hoy),
        orden: e.ordenCamara,
        porcentaje: e.comisionPct == null ? null : Number(e.comisionPct),
        alta: fecha(e.createdAt)!,
        pruebaHasta: fecha(e.pruebaHasta),
        primerPago,
        mesesConNosotros: primerPago ? Math.floor(mesesEntre(primerPago, hoy)) : null,
        mesesComisionRestantes: mesesRestantesDeComision(hoy, comisionHasta),
        comisionHasta,
        comisionTotal: e.comisiones.reduce((a, c) => a + num(c.monto), 0),
        facturadoTotal: e.pagos.reduce((a, p) => a + num(p.montoArs), 0),
        codigo: e.cupon?.codigo ?? null,
        coberturaHasta,
      };
    });
  }

  /** Ficha de la cámara: indicadores, tramo y clientes. */
  async fichaCamara(id: string) {
    const camara = await this.prisma.camara.findUnique({ where: { id }, include: { cupones: { orderBy: { createdAt: 'asc' } } } });
    if (!camara) throw new NotFoundException('Cámara no encontrada');
    const hoy = fechaHoyAR();
    const mes = primerDiaDelMes(hoy);
    const finMes = sumarMeses(mes, 1);
    const clientes = await this.clientesDe(id, hoy);
    const ids = clientes.map((c) => c.empresaId);

    const [pagosMes, pagosTotal, descuentos, comisionMes, comisionTotal] = await Promise.all([
      this.prisma.pago.aggregate({ where: { empresaId: { in: ids }, estado: 'confirmado', periodo: aDate(mes) }, _sum: { montoArs: true } }),
      this.prisma.pago.aggregate({ where: { empresaId: { in: ids }, estado: 'confirmado' }, _sum: { montoArs: true } }),
      this.prisma.pago.aggregate({ where: { empresaId: { in: ids }, estado: 'confirmado', cupon: { camaraId: id } }, _sum: { descuentoArs: true } }),
      this.prisma.comision.aggregate({ where: { camaraId: id, mes: aDate(mes) }, _sum: { monto: true } }),
      this.prisma.comision.aggregate({ where: { camaraId: id }, _sum: { monto: true } }),
    ]);

    const conNumero = clientes.filter((c) => c.orden != null).length;
    const activos = clientes.filter((c) => c.estado === 'activo').length;
    const nuevosMes = clientes.filter((c) => c.primerPago && c.primerPago >= mes && c.primerPago < finMes).length;
    const bajasMes = clientes.filter((c) => this.bajaEnMes(c, mes, finMes)).length;
    return {
      camara: {
        id: camara.id,
        nombre: camara.nombre,
        contactoNombre: camara.contactoNombre,
        contactoEmail: camara.contactoEmail,
        contactoTelefono: camara.contactoTelefono,
        activa: camara.activa,
        mesesComision: camara.mesesComision,
        tramos: camara.tramos as unknown as TramoComision[],
        notas: camara.notas,
      },
      cupones: camara.cupones.map((k) => this.cuponFila(k)),
      indicadores: {
        registros: clientes.length,
        enPrueba: clientes.filter((c) => c.estado === 'prueba').length,
        convertidos: clientes.filter((c) => c.primerPago).length,
        conversion: clientes.length ? clientes.filter((c) => c.primerPago).length / clientes.length : null,
        activos,
        nuevosMes,
        bajasMes,
        tasaBajas: activos + bajasMes ? bajasMes / (activos + bajasMes) : null,
        facturadoMes: num(pagosMes._sum.montoArs),
        facturadoTotal: num(pagosTotal._sum.montoArs),
        descuentosOtorgados: num(descuentos._sum.descuentoArs),
        comisionMes: num(comisionMes._sum.monto),
        comisionTotal: num(comisionTotal._sum.monto),
        tramo: { clientesConNumero: conNumero, ...tramoActual(camara.tramos as unknown as TramoComision[], conNumero) },
      },
      clientes,
    };
  }

  /** La baja cuenta en el mes en que vence lo pagado más los días de gracia. */
  private bajaEnMes(c: ClienteCamara, mes: string, finMes: string) {
    if (c.estado !== 'baja' || !c.coberturaHasta) return false;
    const baja = sumarDias(c.coberturaHasta, DIAS_GRACIA_CLIENTE);
    return baja >= mes && baja < finMes;
  }

  // ---- Cupones -----------------------------------------------------------

  private cuponFila(k: { id: string; codigo: string; tipo: string; camaraId: string | null; descripcion: string | null; diasPrueba: number | null; reglas: Prisma.JsonValue; desde: Date | null; hasta: Date | null; maxUsos: number | null; usos: number; activo: boolean }) {
    return {
      id: k.id,
      codigo: k.codigo,
      tipo: k.tipo,
      camaraId: k.camaraId,
      descripcion: k.descripcion,
      diasPrueba: k.diasPrueba,
      reglas: (k.reglas ?? {}) as ReglasCupon,
      desde: fecha(k.desde),
      hasta: fecha(k.hasta),
      maxUsos: k.maxUsos,
      usos: k.usos,
      activo: k.activo,
    };
  }

  async listarCupones() {
    const cupones = await this.prisma.cupon.findMany({ orderBy: [{ activo: 'desc' }, { codigo: 'asc' }], include: { camara: { select: { nombre: true } } } });
    return cupones.map((k) => ({ ...this.cuponFila(k), camara: k.camara?.nombre ?? null }));
  }

  async crearCupon(dto: CuponDto) {
    const codigo = normalizarCodigo(dto.codigo);
    if (await this.prisma.cupon.findUnique({ where: { codigo } })) throw new ConflictException(`Ya existe el código ${codigo}`);
    if (dto.tipo === 'camara' && !dto.camaraId) throw new BadRequestException('Un código de cámara tiene que pertenecer a una cámara');
    const k = await this.prisma.cupon.create({ data: { ...this.datosCupon(dto), codigo, tipo: dto.tipo } });
    return this.cuponFila(k);
  }

  async editarCupon(id: string, dto: Partial<CuponDto>) {
    const actual = await this.prisma.cupon.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Cupón no encontrado');
    const codigo = dto.codigo ? normalizarCodigo(dto.codigo) : undefined;
    if (codigo && codigo !== actual.codigo && (await this.prisma.cupon.findUnique({ where: { codigo } }))) throw new ConflictException(`Ya existe el código ${codigo}`);
    const k = await this.prisma.cupon.update({ where: { id }, data: { ...this.datosCupon(dto), codigo, tipo: dto.tipo } });
    return this.cuponFila(k);
  }

  private datosCupon(dto: Partial<CuponDto>) {
    return {
      camaraId: dto.camaraId === undefined ? undefined : dto.camaraId,
      descripcion: dto.descripcion,
      diasPrueba: dto.diasPrueba,
      reglas: dto.reglas ? (dto.reglas as unknown as Prisma.InputJsonValue) : undefined,
      desde: dto.desde === undefined ? undefined : dto.desde ? aDate(dto.desde) : null,
      hasta: dto.hasta === undefined ? undefined : dto.hasta ? aDate(dto.hasta) : null,
      maxUsos: dto.maxUsos,
      activo: dto.activo,
    };
  }

  // ---- Liquidaciones -----------------------------------------------------

  /** Detalle de la liquidación de una cámara para un mes (AAAA-MM). */
  async liquidacion(camaraId: string, mesTexto: string) {
    const camara = await this.existeCamara(camaraId);
    const mes = `${mesTexto}-01`;
    const [liq, lineas] = await Promise.all([
      this.prisma.liquidacion.findUnique({ where: { camaraId_mes: { camaraId, mes: aDate(mes) } } }),
      this.prisma.comision.findMany({
        where: { camaraId, mes: aDate(mes) },
        include: { empresa: { select: { nombre: true, ordenCamara: true } }, pago: { select: { plan: true, ciclo: true, cuota: true, cuotas: true, periodo: true, montoArs: true, precioLista: true } } },
        orderBy: [{ empresa: { ordenCamara: 'asc' } }, { createdAt: 'asc' }],
      }),
    ]);
    return {
      camara: { id: camara.id, nombre: camara.nombre },
      mes: mesTexto,
      estado: liq?.estado ?? 'pendiente',
      id: liq?.id ?? null,
      aprobadaEn: liq?.aprobadaEn?.toISOString() ?? null,
      aprobadaPor: liq?.aprobadaPor ?? null,
      pagadaEn: fecha(liq?.pagadaEn),
      referencia: liq?.referencia ?? null,
      total: lineas.reduce((a, l) => a + num(l.monto), 0),
      lineas: lineas.map((l) => ({
        id: l.id,
        tipo: l.tipo,
        empresa: l.empresa.nombre,
        orden: l.empresa.ordenCamara,
        plan: l.pago.plan,
        ciclo: l.pago.ciclo,
        cuota: l.pago.cuota ? `${l.pago.cuota}/${l.pago.cuotas}` : null,
        precioLista: num(l.pago.precioLista),
        cobrado: num(l.pago.montoArs),
        base: num(l.base),
        proporcion: num(l.proporcion),
        porcentaje: num(l.porcentaje),
        monto: num(l.monto),
        periodoDesde: fecha(l.periodoDesde),
        periodoHasta: fecha(l.periodoHasta),
      })),
    };
  }

  async aprobarLiquidacion(camaraId: string, mesTexto: string, hechoPor: string) {
    await this.existeCamara(camaraId);
    const mes = aDate(`${mesTexto}-01`);
    return this.prisma.$transaction(async (tx) => {
      const actual = await tx.liquidacion.findUnique({ where: { camaraId_mes: { camaraId, mes } } });
      if (actual && actual.estado !== 'pendiente') throw new BadRequestException('Esa liquidación ya está aprobada');
      const lineas = await tx.comision.findMany({ where: { camaraId, mes }, select: { id: true, monto: true } });
      if (lineas.length === 0) throw new BadRequestException('No hay comisiones para liquidar en ese mes');
      const total = lineas.reduce((a, l) => a + num(l.monto), 0);
      const liq = await tx.liquidacion.upsert({
        where: { camaraId_mes: { camaraId, mes } },
        create: { camaraId, mes, estado: 'aprobada', total, aprobadaEn: new Date(), aprobadaPor: hechoPor },
        update: { estado: 'aprobada', total, aprobadaEn: new Date(), aprobadaPor: hechoPor },
      });
      await tx.comision.updateMany({ where: { id: { in: lineas.map((l) => l.id) } }, data: { liquidacionId: liq.id } });
      return { id: liq.id, estado: liq.estado, total };
    });
  }

  async pagarLiquidacion(id: string, pagadaEn: string, referencia: string) {
    const liq = await this.prisma.liquidacion.findUnique({ where: { id } });
    if (!liq) throw new NotFoundException('Liquidación no encontrada');
    if (liq.estado !== 'aprobada') throw new BadRequestException(liq.estado === 'pagada' ? 'Esa liquidación ya está pagada' : 'Primero hay que aprobarla');
    const r = await this.prisma.liquidacion.update({ where: { id }, data: { estado: 'pagada', pagadaEn: aDate(pagadaEn), referencia: referencia.trim() } });
    return { id: r.id, estado: r.estado };
  }

  /** Meses con comisiones de una cámara y el estado de su liquidación. */
  async mesesLiquidables(camaraId: string) {
    const [grupos, liqs] = await Promise.all([
      this.prisma.comision.groupBy({ by: ['mes'], where: { camaraId }, _sum: { monto: true }, orderBy: { mes: 'desc' } }),
      this.prisma.liquidacion.findMany({ where: { camaraId }, select: { mes: true, estado: true } }),
    ]);
    const estado = new Map(liqs.map((l) => [fecha(l.mes)!, l.estado]));
    return grupos.map((g) => ({ mes: fecha(g.mes)!.slice(0, 7), total: num(g._sum.monto), estado: estado.get(fecha(g.mes)!) ?? 'pendiente' }));
  }

  // ---- Origen del cliente ------------------------------------------------

  /** Solo el admin corrige a mano de qué cámara vino un cliente; cada cambio queda registrado. */
  async cambiarOrigen(empresaId: string, dto: OrigenDto, hechoPor: string) {
    return this.prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.findUnique({ where: { id: empresaId } });
      if (!empresa) throw new NotFoundException('Empresa no encontrada');
      let camaraId = dto.camaraId;
      if (dto.cuponId) {
        const cupon = await tx.cupon.findUnique({ where: { id: dto.cuponId } });
        if (!cupon) throw new NotFoundException('Cupón no encontrado');
        camaraId = cupon.camaraId;
      }
      if (camaraId && !(await tx.camara.findUnique({ where: { id: camaraId } }))) throw new NotFoundException('Cámara no encontrada');
      const cambiaCamara = (camaraId ?? null) !== empresa.camaraId;
      await tx.empresa.update({
        where: { id: empresaId },
        data: {
          camaraId: camaraId ?? null,
          cuponId: dto.cuponId ?? null,
          // Con otra cámara el número de orden y el porcentaje se asignan de nuevo con el próximo pago.
          ...(cambiaCamara ? { ordenCamara: null, comisionPct: null, comisionHasta: null } : {}),
        },
      });
      await tx.cambioOrigen.create({
        data: {
          empresaId,
          camaraAnteriorId: empresa.camaraId,
          camaraNuevaId: camaraId ?? null,
          cuponAnteriorId: empresa.cuponId,
          cuponNuevoId: dto.cuponId ?? null,
          motivo: dto.motivo.trim(),
          hechoPor,
        },
      });
      return { empresaId, camaraId: camaraId ?? null, cuponId: dto.cuponId ?? null };
    });
  }

  async historialOrigen(empresaId: string) {
    const cambios = await this.prisma.cambioOrigen.findMany({ where: { empresaId }, orderBy: { createdAt: 'desc' } });
    return cambios.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }));
  }

  // ---- Indicadores generales ---------------------------------------------

  async resumen() {
    const hoy = fechaHoyAR();
    const mes = primerDiaDelMes(hoy);
    const camaras = await this.listarCamaras();
    const [comisionMes, aprobadasSinPagar, descuentos, activos] = await Promise.all([
      this.prisma.comision.aggregate({ where: { mes: aDate(mes) }, _sum: { monto: true } }),
      this.prisma.liquidacion.aggregate({ where: { estado: 'aprobada' }, _sum: { total: true } }),
      this.prisma.pago.aggregate({ where: { estado: 'confirmado', cuponId: { not: null } }, _sum: { descuentoArs: true } }),
      this.prisma.empresa.findMany({
        where: { camaraId: { not: null }, comisionPct: { not: null }, comisionHasta: { gt: aDate(hoy) }, deletedAt: null },
        select: { comisionPct: true, comisionHasta: true, pagos: { where: { estado: 'confirmado' }, orderBy: { periodoDesde: 'desc' }, take: 1, select: { montoArs: true, periodoDesde: true, periodoHasta: true } } },
      }),
    ]);

    // Estimado de los próximos 6 meses: lo que paga cada cliente activo por mes × su porcentaje, mientras dure su comisión.
    const estimado = Array.from({ length: 6 }, (_, i) => ({ mes: sumarMeses(mes, i + 1).slice(0, 7), monto: 0 }));
    for (const e of activos) {
      const ultimo = e.pagos[0];
      if (!ultimo?.periodoDesde || !ultimo.periodoHasta) continue;
      const meses = mesesEntre(fecha(ultimo.periodoDesde)!, fecha(ultimo.periodoHasta)!);
      if (meses <= 0) continue;
      const porMes = (num(ultimo.montoArs) / meses) * (num(e.comisionPct) / 100);
      for (const m of estimado) {
        if (`${m.mes}-01` < fecha(e.comisionHasta)!) m.monto += porMes;
      }
    }
    return {
      porCamara: camaras.map((c) => ({ id: c.id, nombre: c.nombre, registros: c.registros, pagan: c.pagan, conversion: c.conversion, activos: c.activos })),
      comisionMes: num(comisionMes._sum.monto),
      aprobadasSinPagar: num(aprobadasSinPagar._sum.total),
      estimadoProximosMeses: estimado.map((m) => ({ ...m, monto: Math.round(m.monto) })),
      descuentosOtorgados: num(descuentos._sum.descuentoArs),
    };
  }
}
