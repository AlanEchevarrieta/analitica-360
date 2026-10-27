import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { cifrar, descifrar } from '../../common/cifrado.js';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MercadoPagoAdapter } from './adapters/mercadopago.adapter.js';
import type { PasarelaAdapter } from './adapters/pasarela.adapter.interface.js';
import { StripeAdapter } from './adapters/stripe.adapter.js';
import { UalaAdapter } from './adapters/uala.adapter.js';
import type { ConfigurarPasarelaDto, CrearCobroRapidoDto } from './dto/configurar-pasarela.dto.js';
import type {
  EstadoTransaccion,
  OrigenCobroTipo,
  ProveedorPasarela,
} from './pasarelas.types.js';

@Injectable()
export class PasarelasCoordinadorService {
  private readonly logger = new Logger('PasarelasCoordinador');
  private readonly adapters = new Map<ProveedorPasarela, PasarelaAdapter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    mpAdapter: MercadoPagoAdapter,
    ualaAdapter: UalaAdapter,
    stripeAdapter: StripeAdapter,
  ) {
    this.adapters.set('mercadopago', mpAdapter);
    this.adapters.set('uala', ualaAdapter);
    this.adapters.set('stripe', stripeAdapter);
  }

  private get claveCifrado(): string {
    return this.config.get('CLAVE_CIFRADO', { infer: true }) || '';
  }

  private get apiUrlPublica(): string {
    return this.config.get('API_URL_PUBLICA', { infer: true }) || 'http://localhost:3001';
  }

  private getAdapter(proveedor: ProveedorPasarela): PasarelaAdapter {
    const adapter = this.adapters.get(proveedor);
    if (!adapter) throw new BadRequestException(`Pasarela no soportada: ${proveedor}`);
    return adapter;
  }

  /** Devuelve el estado de conexión de las pasarelas para una empresa (sin exponer secretos). */
  async obtenerConfiguracion(empresaId: string) {
    const configs = await this.prisma.empresaPasarelaConfig.findMany({
      where: { empresaId },
    });

    const lista = (['mercadopago', 'uala', 'stripe'] as ProveedorPasarela[]).map((prov) => {
      const encontrada = configs.find((c) => c.proveedor === prov);
      return {
        proveedor: prov,
        conectado: Boolean(encontrada?.habilitado),
        habilitado: encontrada?.habilitado ?? false,
        publicKey: encontrada?.publicKey ?? null,
        usoTienda: encontrada?.usoTienda ?? true,
        usoPos: encontrada?.usoPos ?? true,
        usoCuentas: encontrada?.usoCuentas ?? true,
        usoTurnos: encontrada?.usoTurnos ?? true,
        conectadoEn: encontrada?.conectadoEn ?? null,
        actualizadoEn: encontrada?.actualizadoEn ?? null,
      };
    });

    return { pasarelas: lista };
  }

  /** Guarda o actualiza credenciales de una pasarela cifrándolas con AES-256-GCM. */
  async guardarConfiguracion(empresaId: string, dto: ConfigurarPasarelaDto) {
    if (!this.claveCifrado) {
      throw new Error('CLAVE_CIFRADO no configurada en el servidor');
    }

    const credencialesCifradas = cifrar(JSON.stringify(dto.credenciales), this.claveCifrado);

    return this.prisma.empresaPasarelaConfig.upsert({
      where: {
        empresaId_proveedor: {
          empresaId,
          proveedor: dto.proveedor,
        },
      },
      create: {
        empresaId,
        proveedor: dto.proveedor,
        habilitado: true,
        credenciales: credencialesCifradas,
        publicKey: dto.publicKey ?? null,
        webhookSecret: dto.webhookSecret ? cifrar(dto.webhookSecret, this.claveCifrado) : null,
        usoTienda: dto.usoTienda ?? true,
        usoPos: dto.usoPos ?? true,
        usoCuentas: dto.usoCuentas ?? true,
        usoTurnos: dto.usoTurnos ?? true,
      },
      update: {
        habilitado: true,
        credenciales: credencialesCifradas,
        publicKey: dto.publicKey ?? undefined,
        webhookSecret: dto.webhookSecret ? cifrar(dto.webhookSecret, this.claveCifrado) : undefined,
        usoTienda: dto.usoTienda,
        usoPos: dto.usoPos,
        usoCuentas: dto.usoCuentas,
        usoTurnos: dto.usoTurnos,
        actualizadoEn: new Date(),
      },
    });
  }

  /** Desconecta una pasarela de la empresa. */
  async desconectar(empresaId: string, proveedor: ProveedorPasarela) {
    await this.prisma.empresaPasarelaConfig.deleteMany({
      where: { empresaId, proveedor },
    });
    return { ok: true };
  }

  /** Genera una intención de cobro y devuelve el link de pago / QR. */
  async crearCobro(empresaId: string, dto: CrearCobroRapidoDto) {
    const config = await this.prisma.empresaPasarelaConfig.findUnique({
      where: {
        empresaId_proveedor: {
          empresaId,
          proveedor: dto.proveedor,
        },
      },
    });

    if (!config || !config.habilitado) {
      throw new BadRequestException(
        `La pasarela ${dto.proveedor} no está configurada o habilitada para este comercio`,
      );
    }

    let credenciales: Record<string, string>;
    try {
      credenciales = JSON.parse(descifrar(config.credenciales, this.claveCifrado)) as Record<
        string,
        string
      >;
    } catch {
      throw new Error('Error al descifrar credenciales de la pasarela');
    }

    const adapter = this.getAdapter(dto.proveedor);
    const resultado = await adapter.crearCobro(
      credenciales,
      {
        monto: dto.monto,
        moneda: dto.moneda || 'ARS',
        concepto: dto.concepto,
        clienteNombre: dto.clienteNombre,
        clienteEmail: dto.clienteEmail,
        origenTipo: dto.origenTipo || 'link_rapido',
        origenId: dto.origenId,
        urlVuelta: dto.urlVuelta,
      },
      this.apiUrlPublica,
    );

    const transaccion = await this.prisma.pasarelaTransaccion.create({
      data: {
        empresaId,
        proveedor: dto.proveedor,
        origenTipo: dto.origenTipo || 'link_rapido',
        origenId: dto.origenId ?? null,
        idExterno: resultado.idExterno,
        urlPago: resultado.urlPago,
        qrData: resultado.qrData,
        moneda: dto.moneda || 'ARS',
        montoBruto: new Prisma.Decimal(dto.monto),
        comisionEstimada: new Prisma.Decimal(resultado.comisionEstimada),
        montoNeto: resultado.montoNeto ? new Prisma.Decimal(resultado.montoNeto) : null,
        estado: resultado.estado,
        clienteNombre: dto.clienteNombre ?? null,
        clienteEmail: dto.clienteEmail ?? null,
        concepto: dto.concepto,
        metadata: resultado.metadata ? (resultado.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    // Ingesta de evento en el Data Lake para trazabilidad
    await this.prisma.lakeEvento
      .create({
        data: {
          empresaId,
          tipoEvento: 'cobro_pasarela_generado',
          entidadId: transaccion.id,
          horaDia: new Date().getHours(),
          diaSemana: new Date().getDay(),
          payload: {
            transaccionId: transaccion.id,
            proveedor: dto.proveedor,
            monto: dto.monto,
            origenTipo: dto.origenTipo,
          },
        },
      })
      .catch((e) => this.logger.warn(`No se pudo emitir evento al lake: ${String(e)}`));

    return {
      transaccionId: transaccion.id,
      urlPago: resultado.urlPago,
      qrData: resultado.qrData,
      idExterno: resultado.idExterno,
      monto: dto.monto,
      moneda: dto.moneda || 'ARS',
      estado: resultado.estado,
    };
  }

  /** Listado de transacciones con filtros y paginación. */
  async listarTransacciones(
    empresaId: string,
    query: {
      proveedor?: ProveedorPasarela;
      estado?: EstadoTransaccion;
      origenTipo?: OrigenCobroTipo;
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = Math.min(query.limit ?? 50, 100);
    const offset = query.offset ?? 0;

    const where: Prisma.PasarelaTransaccionWhereInput = {
      empresaId,
      ...(query.proveedor ? { proveedor: query.proveedor } : {}),
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.origenTipo ? { origenTipo: query.origenTipo } : {}),
    };

    const [total, transacciones] = await Promise.all([
      this.prisma.pasarelaTransaccion.count({ where }),
      this.prisma.pasarelaTransaccion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      total,
      limit,
      offset,
      transacciones: transacciones.map((t) => ({
        id: t.id,
        proveedor: t.proveedor,
        origenTipo: t.origenTipo,
        origenId: t.origenId,
        idExterno: t.idExterno,
        urlPago: t.urlPago,
        moneda: t.moneda,
        montoBruto: Number(t.montoBruto),
        comisionEstimada: Number(t.comisionEstimada),
        montoNeto: t.montoNeto ? Number(t.montoNeto) : null,
        estado: t.estado,
        clienteNombre: t.clienteNombre,
        clienteEmail: t.clienteEmail,
        concepto: t.concepto,
        pagadoEn: t.pagadoEn,
        createdAt: t.createdAt,
      })),
    };
  }

  /** Métricas y comisiones acumuladas del mes. */
  async obtenerMetricas(empresaId: string) {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const transacciones = await this.prisma.pasarelaTransaccion.findMany({
      where: {
        empresaId,
        createdAt: { gte: inicioMes },
      },
    });

    let totalBruto = 0;
    let totalComisiones = 0;
    let totalNeto = 0;
    let aprobadas = 0;
    const porProveedor: Record<string, { total: number; comisiones: number; cantidad: number }> = {
      mercadopago: { total: 0, comisiones: 0, cantidad: 0 },
      uala: { total: 0, comisiones: 0, cantidad: 0 },
      stripe: { total: 0, comisiones: 0, cantidad: 0 },
    };

    for (const t of transacciones) {
      const monto = Number(t.montoBruto);
      const comision = Number(t.comisionEstimada);
      const neto = t.montoNeto ? Number(t.montoNeto) : monto - comision;

      if (t.estado === 'aprobado') {
        totalBruto += monto;
        totalComisiones += comision;
        totalNeto += neto;
        aprobadas++;

        if (porProveedor[t.proveedor]) {
          porProveedor[t.proveedor]!.total += monto;
          porProveedor[t.proveedor]!.comisiones += comision;
          porProveedor[t.proveedor]!.cantidad++;
        }
      }
    }

    const tasaAprobacion =
      transacciones.length > 0 ? Math.round((aprobadas / transacciones.length) * 100) : 0;

    return {
      periodo: 'mes_actual',
      totalBruto,
      totalComisiones,
      totalNeto,
      totalTransacciones: transacciones.length,
      aprobadas,
      tasaAprobacion,
      porProveedor,
    };
  }

  /** Procesa webhooks entrantes de cualquier pasarela con comprobación de idempotencia. */
  async procesarWebhook(
    proveedor: ProveedorPasarela,
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const adapter = this.getAdapter(proveedor);

    // Buscamos la transacción por idExterno si viene en el payload
    const p = payload as Record<string, unknown> | undefined;
    const idExternoTentativo =
      (p?.data as { id?: string })?.id ||
      (p?.order_id as string) ||
      (p?.id as string);

    let transaccion = idExternoTentativo
      ? await this.prisma.pasarelaTransaccion.findFirst({
          where: { proveedor, idExterno: String(idExternoTentativo) },
        })
      : null;

    if (!transaccion && idExternoTentativo) {
      this.logger.warn(`Webhook ${proveedor}: transacción con idExterno ${idExternoTentativo} no encontrada`);
      return { ok: true, mensaje: 'Ignorado: transacción no registrada' };
    }

    // Si ya está aprobada, respondemos de forma idempotente sin re-ejecutar efectos
    if (transaccion && transaccion.estado === 'aprobado') {
      return { ok: true, mensaje: 'Transacción ya procesada previamente (idempotente)' };
    }

    // Buscamos la configuración de la empresa para tener sus credenciales
    const config = transaccion
      ? await this.prisma.empresaPasarelaConfig.findUnique({
          where: { empresaId_proveedor: { empresaId: transaccion.empresaId, proveedor } },
        })
      : null;

    let credenciales: Record<string, string> = {};
    let webhookSecret: string | null = null;

    if (config) {
      try {
        credenciales = JSON.parse(descifrar(config.credenciales, this.claveCifrado)) as Record<string, string>;
        if (config.webhookSecret) {
          webhookSecret = descifrar(config.webhookSecret, this.claveCifrado);
        }
      } catch (e) {
        this.logger.error(`Error descifrando credenciales para webhook: ${String(e)}`);
      }
    }

    const resultado = await adapter.procesarWebhook(credenciales, webhookSecret, payload, headers);

    if (!resultado.reconocido || !resultado.idExterno) {
      return { ok: false, error: resultado.error || 'Evento no reconocido' };
    }

    if (!transaccion) {
      transaccion = await this.prisma.pasarelaTransaccion.findFirst({
        where: { proveedor, idExterno: resultado.idExterno },
      });
    }

    if (!transaccion) {
      return { ok: true, mensaje: 'Transacción no encontrada' };
    }

    if (resultado.estadoNuevo && transaccion.estado !== resultado.estadoNuevo) {
      await this.prisma.pasarelaTransaccion.update({
        where: { id: transaccion.id },
        data: {
          estado: resultado.estadoNuevo,
          pagadoEn: resultado.estadoNuevo === 'aprobado' ? resultado.pagadoEn ?? new Date() : undefined,
          actualizadoEn: new Date(),
        },
      });

      // Disparar automatización en cascada si fue aprobado
      if (resultado.estadoNuevo === 'aprobado') {
        await this.ejecutarEfectoSecundarioAprobado(transaccion);
      }
    }

    return { ok: true, estado: resultado.estadoNuevo };
  }

  /** Ejecuta los efectos en cascada en Pedidos, Ventas, Cuentas Corrientes o Turnos. */
  private async ejecutarEfectoSecundarioAprobado(transaccion: {
    id: string;
    empresaId: string;
    origenTipo: string;
    origenId: string | null;
    montoBruto: Prisma.Decimal;
    proveedor: string;
  }) {
    const { empresaId, origenTipo, origenId, montoBruto, proveedor } = transaccion;

    try {
      // 1. Tienda Online
      if (origenTipo === 'pedido_tienda' && origenId) {
        await this.prisma.pedido.updateMany({
          where: { id: origenId, empresaId },
          data: {
            pagoEstado: 'approved',
            pagoId: transaccion.id,
            pagoFecha: new Date(),
            estado: 'preparando',
          },
        });
      }

      // 2. Venta Mostrador / POS
      if (origenTipo === 'venta_pos' && origenId) {
        await this.prisma.venta.updateMany({
          where: { id: origenId, empresaId },
          data: {
            estadoCobro: 'pagado',
            fechaCobroSaldo: new Date(),
          },
        });
      }

      // 3. Agenda de Turnos (confirmación de seña)
      if (origenTipo === 'reserva_turno' && origenId) {
        await this.prisma.turno.updateMany({
          where: { id: origenId, empresaId },
          data: {
            estado: 'confirmado',
          },
        });
      }

      // 4. Ingesta al Data Lakehouse para Copilot IA
      await this.prisma.lakeEvento.create({
        data: {
          empresaId,
          tipoEvento: 'cobro_pasarela_confirmado',
          entidadId: transaccion.id,
          horaDia: new Date().getHours(),
          diaSemana: new Date().getDay(),
          payload: {
            transaccionId: transaccion.id,
            proveedor,
            origenTipo,
            monto: Number(montoBruto),
          },
        },
      });
    } catch (e) {
      this.logger.error(`Error ejecutando efectos secundarios de cobro aprobado: ${String(e)}`);
    }
  }
}
