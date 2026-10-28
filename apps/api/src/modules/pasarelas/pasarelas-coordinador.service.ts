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

    const tiendaConfig = await this.prisma.tiendaConfig.findUnique({
      where: { empresaId },
      select: { subdominio: true },
    });
    const empresa = !tiendaConfig
      ? await this.prisma.empresa.findUnique({
          where: { id: empresaId },
          select: { nombre: true },
        })
      : null;

    const negocioSlug =
      tiendaConfig?.subdominio ||
      (empresa?.nombre ? this.slugify(empresa.nombre) : undefined);

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
        negocioSlug,
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

  /** Función auxiliar para transformar nombres de comercio a slugs seguros. */
  private slugify(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /** Resuelve el ID de empresa a partir del subdominio de tienda, nombre slugificado o UUID. */
  async resolverEmpresaId(negocio: string): Promise<string | null> {
    if (!negocio) return null;
    const negocioNorm = negocio.trim().toLowerCase();

    // 1. Subdominio de tienda online
    const tienda = await this.prisma.tiendaConfig.findUnique({
      where: { subdominio: negocioNorm },
      select: { empresaId: true },
    });
    if (tienda) return tienda.empresaId;

    // 2. Si es UUID directo
    const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(negocioNorm);
    if (esUuid) {
      const emp = await this.prisma.empresa.findUnique({
        where: { id: negocioNorm },
        select: { id: true },
      });
      if (emp) return emp.id;
    }

    // 3. Coincidencia con slug de nombre de empresa
    const empresas = await this.prisma.empresa.findMany({
      select: { id: true, nombre: true },
    });
    const buscado = this.slugify(negocioNorm);
    const empMatch = empresas.find((e) => this.slugify(e.nombre) === buscado);
    return empMatch ? empMatch.id : null;
  }

  /** Procesa webhooks entrantes con comprobación de idempotencia, resolución multi-tenant y reglas HMAC. */
  async procesarWebhook(
    opcionesOProveedor:
      | ProveedorPasarela
      | {
          negocio?: string;
          proveedor: ProveedorPasarela;
          payload: unknown;
          headers: Record<string, string | string[] | undefined>;
          query?: Record<string, string | string[] | undefined>;
        },
    payloadArg?: unknown,
    headersArg?: Record<string, string | string[] | undefined>,
    queryArg?: Record<string, string | string[] | undefined>,
  ) {
    let negocio: string | undefined;
    let proveedor: ProveedorPasarela;
    let payload: unknown;
    let headers: Record<string, string | string[] | undefined>;
    let query: Record<string, string | string[] | undefined> | undefined;

    if (typeof opcionesOProveedor === 'string') {
      proveedor = opcionesOProveedor;
      payload = payloadArg;
      headers = headersArg ?? {};
      query = queryArg;
    } else {
      negocio = opcionesOProveedor.negocio;
      proveedor = opcionesOProveedor.proveedor;
      payload = opcionesOProveedor.payload;
      headers = opcionesOProveedor.headers;
      query = opcionesOProveedor.query;
    }

    const adapter = this.getAdapter(proveedor);

    // Si viene la ruta dinámica con el negocio, resolvemos la empresa directamente
    let empresaId: string | null = null;
    if (negocio) {
      empresaId = await this.resolverEmpresaId(negocio);
      if (!empresaId) {
        this.logger.warn(`Webhook dinámico: negocio '${negocio}' no encontrado`);
        return { ok: false, error: `Negocio '${negocio}' no encontrado en el sistema` };
      }
    }

    // Extraemos posible ID de recurso para buscar transacción existente
    const p = payload as Record<string, unknown> | undefined;
    const queryDataId = Array.isArray(query?.['data.id'])
      ? query?.['data.id'][0]
      : (query?.['data.id'] as string | undefined);
    const queryId = Array.isArray(query?.id) ? query?.id[0] : (query?.id as string | undefined);

    const idExternoTentativo =
      queryDataId ||
      queryId ||
      (p?.data as { id?: string | number })?.id ||
      (p?.order_id as string | number) ||
      (p?.id as string | number);

    let transaccion = idExternoTentativo
      ? await this.prisma.pasarelaTransaccion.findFirst({
          where: {
            proveedor,
            idExterno: String(idExternoTentativo),
            ...(empresaId ? { empresaId } : {}),
          },
        })
      : null;

    // Si la transacción ya está aprobada, respondemos de forma idempotente sin re-ejecutar efectos
    if (transaccion && transaccion.estado === 'aprobado') {
      return { ok: true, mensaje: 'Transacción ya procesada previamente (idempotente)' };
    }

    // Si no teníamos empresaId pero encontramos la transacción, usamos su empresaId
    if (!empresaId && transaccion) {
      empresaId = transaccion.empresaId;
    }

    // Buscamos la configuración de pasarela de la empresa para tener sus credenciales y webhookSecret
    const config = empresaId
      ? await this.prisma.empresaPasarelaConfig.findUnique({
          where: { empresaId_proveedor: { empresaId, proveedor } },
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

    const resultado = await adapter.procesarWebhook(credenciales, webhookSecret, payload, headers, query);

    if (!resultado.reconocido || !resultado.idExterno) {
      return { ok: false, error: resultado.error || 'Evento no reconocido o firma inválida' };
    }

    if (!transaccion) {
      transaccion = await this.prisma.pasarelaTransaccion.findFirst({
        where: {
          proveedor,
          idExterno: resultado.idExterno,
          ...(empresaId ? { empresaId } : {}),
        },
      });
    }

    if (!transaccion) {
      this.logger.warn(`Webhook ${proveedor}: transacción con idExterno ${resultado.idExterno} no registrada en la BD`);
      return { ok: true, mensaje: 'Evento procesado pero transacción no encontrada' };
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
