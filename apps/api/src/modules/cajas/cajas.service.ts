import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  AbrirCajaInput,
  CerrarCajaInput,
  CrearMovimientoCajaInput,
  ListarCajasQuery,
} from './cajas.dto.js';
import type {
  DesgloseMedioPago,
  EstadoCajaActiva,
  MovimientoResumen,
  ResumenReporteXZ,
} from './cajas.types.js';

const ETIQUETAS_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Tarjeta de Débito',
  credito: 'Tarjeta de Crédito',
  transferencia: 'Transferencia Bancaria',
  qr: 'Mercado Pago / QR',
  mercadopago: 'Mercado Pago',
  cuenta_corriente: 'Cuenta Corriente',
};

@Injectable()
export class CajasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Obtiene la caja abierta en curso para la empresa con cálculos de efectivo en tiempo real. */
  async obtenerActiva(empresaId: string): Promise<EstadoCajaActiva> {
    const caja = await this.prisma.cajaSesion.findFirst({
      where: { empresaId, estado: 'abierta' },
      include: {
        usuarioApertura: true,
        ubicacion: true,
        movimientos: {
          include: { usuario: true },
          orderBy: { fecha: 'desc' },
          take: 20,
        },
      },
      orderBy: { fechaApertura: 'desc' },
    });

    if (!caja) {
      return {
        caja: null,
        totalesEnVivo: null,
        movimientosRecientes: [],
      };
    }

    // Ventas vinculadas a este turno (o posteriores a la apertura si no tenían cajaSesionId)
    const ventas = await this.prisma.venta.findMany({
      where: {
        empresaId,
        deletedAt: null,
        OR: [
          { cajaSesionId: caja.id },
          {
            cajaSesionId: null,
            fecha: { gte: caja.fechaApertura },
          },
        ],
      },
      select: {
        id: true,
        formaPago: true,
        totalSinInteres: true,
        totalConInteres: true,
        descuento: true,
      },
    });

    let ventasEfectivo = 0;
    let ventasDigitales = 0;

    for (const v of ventas) {
      const monto = Number(v.totalConInteres ?? v.totalSinInteres ?? 0);
      if (v.formaPago.toLowerCase() === 'efectivo') {
        ventasEfectivo += monto;
      } else {
        ventasDigitales += monto;
      }
    }

    // Todos los movimientos de la caja
    const todosMovimientos = await this.prisma.cajaMovimiento.findMany({
      where: { cajaSesionId: caja.id },
      select: { tipo: true, monto: true },
    });

    let totalIngresos = 0;
    let totalEgresos = 0;
    for (const m of todosMovimientos) {
      const monto = Number(m.monto);
      if (m.tipo === 'ingreso') totalIngresos += monto;
      else if (m.tipo === 'egreso') totalEgresos += monto;
    }

    const montoInicial = Number(caja.montoInicial);
    const efectivoEnCajaEsperado =
      montoInicial + ventasEfectivo + totalIngresos - totalEgresos;

    const movimientosRecientes: MovimientoResumen[] = caja.movimientos.map((m) => ({
      id: m.id,
      tipo: m.tipo as 'ingreso' | 'egreso',
      monto: Number(m.monto),
      concepto: m.concepto,
      comprobanteRef: m.comprobanteRef,
      fecha: m.fecha.toISOString(),
      usuarioNombre: m.usuario.nombre,
    }));

    return {
      caja: {
        id: caja.id,
        nombreCaja: caja.nombreCaja,
        estado: 'abierta',
        montoInicial,
        fechaApertura: caja.fechaApertura.toISOString(),
        usuarioApertura: {
          id: caja.usuarioApertura.id,
          nombre: caja.usuarioApertura.nombre,
        },
        ubicacionId: caja.ubicacionId,
        notasApertura: caja.notasApertura,
      },
      totalesEnVivo: {
        ventasEfectivo,
        ventasDigitales,
        cantidadVentas: ventas.length,
        totalIngresos,
        totalEgresos,
        efectivoEnCajaEsperado,
      },
      movimientosRecientes,
    };
  }

  /** Inicia un nuevo turno de caja con fondo de cambio. */
  async abrir(empresaId: string, usuarioId: string, dto: AbrirCajaInput) {
    const existente = await this.prisma.cajaSesion.findFirst({
      where: { empresaId, estado: 'abierta' },
    });

    if (existente) {
      throw new BadRequestException(
        `Ya hay un turno abierto (${existente.nombreCaja}). Debe realizarse el cierre y arqueo antes de abrir uno nuevo.`,
      );
    }

    return this.prisma.cajaSesion.create({
      data: {
        empresaId,
        usuarioAperturaId: usuarioId,
        ubicacionId: dto.ubicacionId,
        nombreCaja: dto.nombreCaja || 'Caja Principal',
        montoInicial: dto.montoInicial,
        estado: 'abierta',
        notasApertura: dto.notasApertura,
      },
      include: {
        usuarioApertura: true,
      },
    });
  }

  /** Registra un movimiento (sangría / egreso o ingreso extraordinario). */
  async crearMovimiento(
    empresaId: string,
    usuarioId: string,
    cajaId: string,
    dto: CrearMovimientoCajaInput,
  ) {
    const caja = await this.prisma.cajaSesion.findFirst({
      where: { id: cajaId, empresaId, estado: 'abierta' },
    });

    if (!caja) {
      throw new NotFoundException('La caja indicada no existe o ya fue cerrada.');
    }

    return this.prisma.cajaMovimiento.create({
      data: {
        cajaSesionId: caja.id,
        empresaId,
        usuarioId,
        tipo: dto.tipo,
        monto: dto.monto,
        concepto: dto.concepto,
        comprobanteRef: dto.comprobanteRef,
      },
      include: {
        usuario: { select: { id: true, nombre: true } },
      },
    });
  }

  /** Emite el Reporte X (corte parcial en tiempo real sin cerrar la caja). */
  async reporteX(empresaId: string, cajaId: string): Promise<ResumenReporteXZ> {
    const caja = await this.prisma.cajaSesion.findFirst({
      where: { id: cajaId, empresaId },
      include: {
        usuarioApertura: true,
        usuarioCierre: true,
        ubicacion: true,
        empresa: {
          include: { configuracion: true },
        },
        movimientos: {
          include: { usuario: true },
          orderBy: { fecha: 'asc' },
        },
      },
    });

    if (!caja) {
      throw new NotFoundException('Caja no encontrada.');
    }

    return this.construirReporte(caja, 'X');
  }

  /**
   * Arqueo Ciego y Cierre de Caja (Reporte Z definitivo).
   * El cajero declara lo que cuenta en el cajón (montoDeclarado) sin ver el esperado.
   */
  async cerrar(
    empresaId: string,
    usuarioId: string,
    cajaId: string,
    dto: CerrarCajaInput,
  ): Promise<ResumenReporteXZ> {
    const caja = await this.prisma.cajaSesion.findFirst({
      where: { id: cajaId, empresaId, estado: 'abierta' },
      include: {
        usuarioApertura: true,
        ubicacion: true,
        empresa: {
          include: { configuracion: true },
        },
        movimientos: {
          include: { usuario: true },
        },
      },
    });

    if (!caja) {
      throw new BadRequestException('La caja no existe o ya fue cerrada previamente.');
    }

    // Obtenemos los totales exactos
    const reporteCalculado = await this.construirReporte(caja, 'Z');
    const montoDeclarado = Number(dto.montoDeclarado);
    const montoEsperado = reporteCalculado.efectivoEsperado;
    const diferencia = montoDeclarado - montoEsperado;

    // Actualizamos la caja a cerrada y congelamos métricas
    const cajaCerrada = await this.prisma.cajaSesion.update({
      where: { id: cajaId },
      data: {
        estado: 'cerrada',
        fechaCierre: new Date(),
        usuarioCierreId: usuarioId,
        montoDeclarado,
        montoEsperado,
        diferencia,
        totalVentasEfectivo: reporteCalculado.totalVentasEfectivo,
        totalVentasDigital: reporteCalculado.totalVentasDigital,
        totalIngresos: reporteCalculado.totalIngresos,
        totalEgresos: reporteCalculado.totalEgresos,
        notasCierre: dto.notasCierre,
      },
      include: {
        usuarioApertura: true,
        usuarioCierre: true,
        ubicacion: true,
        empresa: {
          include: { configuracion: true },
        },
        movimientos: {
          include: { usuario: true },
          orderBy: { fecha: 'asc' },
        },
      },
    });

    return {
      ...reporteCalculado,
      estado: 'cerrada',
      fechaCierre: cajaCerrada.fechaCierre instanceof Date ? cajaCerrada.fechaCierre.toISOString() : new Date().toISOString(),
      cajeroCierre: cajaCerrada.usuarioCierre
        ? { id: cajaCerrada.usuarioCierre.id, nombre: cajaCerrada.usuarioCierre.nombre }
        : null,
      montoDeclarado,
      diferencia,
      notasCierre: dto.notasCierre ?? null,
    };
  }

  /** Devuelve el Reporte Z de un turno cerrado. */
  async reporteZ(empresaId: string, cajaId: string): Promise<ResumenReporteXZ> {
    const caja = await this.prisma.cajaSesion.findFirst({
      where: { id: cajaId, empresaId },
      include: {
        usuarioApertura: true,
        usuarioCierre: true,
        ubicacion: true,
        empresa: {
          include: { configuracion: true },
        },
        movimientos: {
          include: { usuario: true },
          orderBy: { fecha: 'asc' },
        },
      },
    });

    if (!caja) throw new NotFoundException('Caja no encontrada.');
    return this.construirReporte(caja, 'Z');
  }

  /** Lista historial de cajas pasadas. */
  async listar(empresaId: string, query: ListarCajasQuery) {
    const where: Record<string, unknown> = { empresaId };

    if (query.desde || query.hasta) {
      where.fechaApertura = {};
      if (query.desde) {
        (where.fechaApertura as Record<string, unknown>).gte = new Date(`${query.desde}T00:00:00Z`);
      }
      if (query.hasta) {
        (where.fechaApertura as Record<string, unknown>).lte = new Date(`${query.hasta}T23:59:59Z`);
      }
    }

    return this.prisma.cajaSesion.findMany({
      where,
      include: {
        usuarioApertura: { select: { id: true, nombre: true } },
        usuarioCierre: { select: { id: true, nombre: true } },
        ubicacion: { select: { id: true, nombre: true } },
        _count: { select: { movimientos: true, ventas: true } },
      },
      orderBy: { fechaApertura: 'desc' },
      take: query.limite,
    });
  }

  /** Construye la estructura de datos unificada para Reportes X y Z. */
  private async construirReporte(
    caja: any,
    tipoReporte: 'X' | 'Z',
  ): Promise<ResumenReporteXZ> {
    const hastaFecha = caja.fechaCierre ?? new Date();

    const ventas = await this.prisma.venta.findMany({
      where: {
        empresaId: caja.empresaId,
        deletedAt: null,
        OR: [
          { cajaSesionId: caja.id },
          {
            cajaSesionId: null,
            fecha: {
              gte: caja.fechaApertura,
              lte: hastaFecha,
            },
          },
        ],
      },
      select: {
        id: true,
        formaPago: true,
        totalSinInteres: true,
        totalConInteres: true,
      },
    });

    // Desglose por medio de pago
    const mediosMap = new Map<string, { cantidad: number; total: number }>();
    let totalVentas = 0;
    let totalVentasEfectivo = 0;
    let totalVentasDigital = 0;

    for (const v of ventas) {
      const medio = v.formaPago.toLowerCase();
      const total = Number(v.totalConInteres ?? v.totalSinInteres ?? 0);
      totalVentas += total;

      if (medio === 'efectivo') {
        totalVentasEfectivo += total;
      } else {
        totalVentasDigital += total;
      }

      const acum = mediosMap.get(medio) ?? { cantidad: 0, total: 0 };
      acum.cantidad += 1;
      acum.total += total;
      mediosMap.set(medio, acum);
    }

    const ventasPorMedioPago: DesgloseMedioPago[] = Array.from(mediosMap.entries()).map(
      ([medio, val]) => ({
        medio,
        etiqueta: ETIQUETAS_PAGO[medio] ?? medio.toUpperCase(),
        cantidad: val.cantidad,
        total: val.total,
      }),
    );

    // Movimientos
    let totalIngresos = 0;
    let totalEgresos = 0;
    const movimientos: MovimientoResumen[] = (caja.movimientos ?? []).map((m: any) => {
      const monto = Number(m.monto);
      if (m.tipo === 'ingreso') totalIngresos += monto;
      if (m.tipo === 'egreso') totalEgresos += monto;

      return {
        id: m.id,
        tipo: m.tipo,
        monto,
        concepto: m.concepto,
        comprobanteRef: m.comprobanteRef,
        fecha: m.fecha instanceof Date ? m.fecha.toISOString() : String(m.fecha),
        usuarioNombre: m.usuario?.nombre ?? 'Cajero',
      };
    });

    const montoInicial = Number(caja.montoInicial);
    const efectivoEsperado = montoInicial + totalVentasEfectivo + totalIngresos - totalEgresos;

    const config = caja.empresa?.configuracion;
    const negocio = {
      nombre: config?.nombreFantasia || caja.empresa?.nombre || 'Mi Comercio',
      cuit: config?.cuit || null,
      direccion: config?.direccion || null,
      telefono: config?.telefono || null,
    };

    return {
      tipoReporte,
      cajaId: caja.id,
      nombreCaja: caja.nombreCaja,
      estado: caja.estado,
      fechaApertura: caja.fechaApertura instanceof Date ? caja.fechaApertura.toISOString() : String(caja.fechaApertura),
      fechaCierre: caja.fechaCierre ? (caja.fechaCierre instanceof Date ? caja.fechaCierre.toISOString() : String(caja.fechaCierre)) : null,
      cajeroApertura: {
        id: caja.usuarioApertura.id,
        nombre: caja.usuarioApertura.nombre,
      },
      cajeroCierre: caja.usuarioCierre
        ? { id: caja.usuarioCierre.id, nombre: caja.usuarioCierre.nombre }
        : null,
      ubicacionNombre: caja.ubicacion?.nombre ?? null,
      negocio,
      montoInicial,
      ventasPorMedioPago,
      totalVentas,
      totalVentasEfectivo,
      totalVentasDigital,
      cantidadVentas: ventas.length,
      movimientos,
      totalIngresos,
      totalEgresos,
      efectivoEsperado,
      montoDeclarado: caja.montoDeclarado != null ? Number(caja.montoDeclarado) : null,
      diferencia: caja.diferencia != null ? Number(caja.diferencia) : null,
      notasApertura: caja.notasApertura,
      notasCierre: caja.notasCierre,
    };
  }
}
