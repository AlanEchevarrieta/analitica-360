import { randomBytes } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UsuarioContext } from '../../common/auth/request-context.types.js';
import { cifrar, descifrar } from '../../common/cifrado.js';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MpTiendaCliente, type TokensMp } from './mp-tienda.cliente.js';
import { debeRenovar, idPagoDelAviso, NOMBRE_PAGO, pagoCorresponde, pkce, urlAutorizacion, type EstadoOAuth } from './mp-tienda.util.js';

interface Credenciales {
  accessToken: string;
  refreshToken: string;
}

/** Mercado Pago en las tiendas: conectar la cuenta del comercio, cobrar cada pedido y recibir los avisos de pago. */
@Injectable()
export class MpTiendaService {
  private readonly logger = new Logger('MercadoPagoTiendas');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly mp: MpTiendaCliente,
  ) {}

  private get clave() {
    return this.config.get('CLAVE_CIFRADO', { infer: true });
  }

  private get api() {
    return this.config.get('API_URL_PUBLICA', { infer: true });
  }

  /** Hace falta la aplicación de Analítica 360 en Mercado Pago, la clave de cifrado y la URL pública de la API. */
  get disponible(): boolean {
    return Boolean(this.mp.configurado && this.clave && this.api);
  }

  private get redirectUri() {
    return `${this.api}/mercadopago/tienda/vuelta`;
  }

  async estado(empresaId: string) {
    const c = await this.prisma.mpCuentaTienda.findUnique({ where: { empresaId } });
    return { disponible: this.disponible, cuenta: c && { mpUserId: c.mpUserId, conectadoEn: c.conectadoEn, venceEn: c.venceEn } };
  }

  /** ¿La tienda puede ofrecer Mercado Pago en el checkout? */
  async habilitado(empresaId: string): Promise<boolean> {
    if (!this.disponible) return false;
    return (await this.prisma.mpCuentaTienda.count({ where: { empresaId } })) > 0;
  }

  /** Link para que el dueño autorice en Mercado Pago (vuelve a /mercadopago/tienda/vuelta). */
  urlConectar(empresaId: string, usuario: UsuarioContext): { url: string } {
    if (usuario.rol !== 'dueno') throw new ForbiddenException('Solo el dueño puede conectar Mercado Pago');
    if (!this.disponible) throw new ServiceUnavailableException('Los cobros con Mercado Pago todavía no están habilitados en Analítica 360');
    const { verificador, desafio } = pkce();
    const estado: EstadoOAuth = { e: empresaId, v: verificador, x: Date.now() + 15 * 60_000 };
    return { url: urlAutorizacion({ clientId: this.config.get('MP_CLIENT_ID', { infer: true })!, redirectUri: this.redirectUri, state: cifrar(JSON.stringify(estado), this.clave!), desafio }) };
  }

  /** Vuelta de Mercado Pago: cambia el código por los tokens y guarda la cuenta. Devuelve adónde mandar al dueño. */
  async vuelta(code: string | undefined, state: string | undefined, error: string | undefined): Promise<string> {
    const app = `${this.config.get('APP_URL_PUBLICA', { infer: true })}/configuracion?seccion=mercadopago`;
    if (error || !code || !state || !this.disponible) return `${app}&mp=cancelado`;
    let estado: EstadoOAuth;
    try {
      estado = JSON.parse(descifrar(state, this.clave!)) as EstadoOAuth;
    } catch {
      return `${app}&mp=error`;
    }
    if (estado.x < Date.now()) return `${app}&mp=vencido`;
    try {
      const t = await this.mp.intercambiar(code, estado.v, this.redirectUri);
      const datos = this.datosTokens(t);
      await this.prisma.mpCuentaTienda.upsert({
        where: { empresaId: estado.e },
        create: { empresaId: estado.e, ...datos, avisoClave: randomBytes(24).toString('base64url') },
        update: { ...datos, conectadoEn: new Date() },
      });
      return `${app}&mp=ok`;
    } catch (e) {
      this.logger.warn(`No se pudo conectar Mercado Pago (empresa ${estado.e}): ${String(e)}`);
      return `${app}&mp=error`;
    }
  }

  async desconectar(empresaId: string, usuario: UsuarioContext): Promise<void> {
    if (usuario.rol !== 'dueno') throw new ForbiddenException('Solo el dueño puede desconectar Mercado Pago');
    await this.prisma.mpCuentaTienda.deleteMany({ where: { empresaId } });
  }

  /** Link de pago (Checkout Pro) de un pedido de la tienda pagado con Mercado Pago. Null si no se pudo armar. */
  async linkDePago(empresaId: string, pedidoId: string): Promise<{ estado: string; url: string | null }> {
    const p = await this.prisma.pedido.findFirst({ where: { id: pedidoId, empresaId, origen: 'tienda_online' }, include: { items: { select: { cantidad: true, precioUnitario: true } } } });
    if (!p || p.formaPagoTienda !== 'mercadopago') throw new NotFoundException('Pedido no encontrado');
    if (p.pagoEstado === 'approved') return { estado: 'approved', url: null };
    if (p.estado === 'cancelado') throw new BadRequestException('El pedido está cancelado');
    const cuenta = await this.prisma.mpCuentaTienda.findUnique({ where: { empresaId } });
    if (!cuenta || !this.disponible) throw new BadRequestException('Esta tienda ya no cobra con Mercado Pago: escribile por WhatsApp para pagar de otra forma');
    const tienda = await this.prisma.tiendaConfig.findUnique({ where: { empresaId }, select: { nombre: true, subdominio: true, dominioPropio: true } });
    const total = totalPedido(p);
    const origen = tienda?.dominioPropio ? `https://${tienda.dominioPropio}` : `https://${tienda?.subdominio}.${this.config.get('TIENDA_DOMINIO_BASE', { infer: true })}`;
    const pref = await this.mp.crearPreferencia(await this.token(cuenta), {
      titulo: `Pedido ${p.numeroPedido}${tienda?.nombre ? ` · ${tienda.nombre}` : ''}`.slice(0, 250),
      total,
      referencia: p.id,
      email: p.clienteEmail,
      nombre: p.clienteNombre,
      avisos: `${this.api}/webhooks/mercadopago-tienda/${cuenta.avisoClave}`,
      volverA: `${origen}/pedido-confirmado?n=${encodeURIComponent(p.numeroPedido)}&id=${p.id}`,
    });
    return { estado: p.pagoEstado ?? 'pendiente', url: pref.initPoint };
  }

  /**
   * Aviso de pago. No se le cree al aviso: con el id se le pregunta el pago a Mercado Pago con el token del
   * comercio, y solo cuenta si es de un pedido de esa empresa y por el total. False = la clave no existe.
   */
  async aviso(clave: string, query: Record<string, unknown>, cuerpo: unknown): Promise<boolean> {
    const cuenta = await this.prisma.mpCuentaTienda.findUnique({ where: { avisoClave: clave } });
    if (!cuenta) return false;
    const id = idPagoDelAviso(query, cuerpo);
    if (!id) return true;
    try {
      const pago = await this.mp.pago(await this.token(cuenta), id);
      const ref = pago.external_reference ?? '';
      if (!/^[0-9a-f-]{36}$/i.test(ref)) return true;
      const p = await this.prisma.pedido.findFirst({ where: { id: ref, empresaId: cuenta.empresaId }, include: { items: { select: { cantidad: true, precioUnitario: true } } } });
      if (!p) return true;
      // Un pago aprobado no se pisa con otro intento rechazado; sí con una devolución de ese mismo pago.
      if (p.pagoEstado === 'approved' && p.pagoId !== String(pago.id)) return true;
      if (pago.status === 'approved' && !pagoCorresponde(pago, { id: p.id, total: totalPedido(p) })) {
        this.logger.warn(`Pago ${String(pago.id)} aprobado por menos que el pedido ${p.numeroPedido}: no se marca como pagado`);
        return true;
      }
      await this.prisma.pedido.update({
        where: { id: p.id },
        data: { pagoEstado: pago.status, pagoId: String(pago.id), pagadoEn: pago.status === 'approved' ? new Date(pago.date_approved ?? Date.now()) : null },
      });
    } catch (e) {
      this.logger.warn(`Aviso de pago sin procesar (${id}): ${String(e)}`);
    }
    return true;
  }

  nombrePago(estado: string | null) {
    return estado ? (NOMBRE_PAGO[estado] ?? estado) : null;
  }

  /** Access token vigente; si vence en menos de una semana, se renueva (con candado para no renovar dos veces). */
  private async token(cuenta: { empresaId: string; credenciales: string; venceEn: Date }): Promise<string> {
    const cred = JSON.parse(descifrar(cuenta.credenciales, this.clave!)) as Credenciales;
    if (!debeRenovar(cuenta.venceEn)) return cred.accessToken;
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'mp-tienda:' + cuenta.empresaId}))`;
        const actual = await tx.mpCuentaTienda.findUnique({ where: { empresaId: cuenta.empresaId } });
        if (!actual) throw new BadRequestException('La cuenta de Mercado Pago se desconectó');
        const c = JSON.parse(descifrar(actual.credenciales, this.clave!)) as Credenciales;
        if (!debeRenovar(actual.venceEn)) return c.accessToken;
        const t = await this.mp.renovar(c.refreshToken);
        await tx.mpCuentaTienda.update({ where: { empresaId: cuenta.empresaId }, data: this.datosTokens(t) });
        return t.accessToken;
      },
      { timeout: 30_000 },
    );
  }

  private datosTokens(t: TokensMp) {
    return {
      mpUserId: t.userId,
      publicKey: t.publicKey,
      credenciales: cifrar(JSON.stringify({ accessToken: t.accessToken, refreshToken: t.refreshToken } satisfies Credenciales), this.clave!),
      venceEn: new Date(Date.now() + t.expiresIn * 1000),
    };
  }
}

/** Lo que hay que cobrar: productos (con la oferta) menos cupón y transferencia, más el envío. */
function totalPedido(p: { items: { cantidad: { toNumber(): number }; precioUnitario: { toNumber(): number } }[]; descuentoCupon: { toNumber(): number }; descuentoTransferencia: { toNumber(): number }; costoEnvio: { toNumber(): number } }) {
  const subtotal = p.items.reduce((a, i) => a + i.cantidad.toNumber() * i.precioUnitario.toNumber(), 0);
  return Math.round(subtotal - p.descuentoCupon.toNumber() - p.descuentoTransferencia.toNumber() + p.costoEnvio.toNumber());
}
