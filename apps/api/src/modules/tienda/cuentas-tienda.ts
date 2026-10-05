import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import { TiendaThrottlerGuard } from './tienda-throttler.guard.js';
import { TIENDA_REPOSITORY, type TiendaRepository } from './tienda.repository.js';
import {
  DURACION_CODIGO_MS,
  DURACION_SESION_MS,
  ESPERA_ENTRE_CODIGOS_MS,
  generarCodigo,
  generarToken,
  hashCodigo,
  hashToken,
  MAX_CODIGOS_POR_HORA,
  MAX_INTENTOS,
  mismoHash,
  nombreDesdeEmail,
  normalizarEmail,
} from './cuenta-tienda.util.js';

const email = z.email('Ingresá un email válido').max(160).transform(normalizarEmail);
const texto = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => v || null);
export const pedirCodigoSchema = z.object({ email });
export const ingresarSchema = z.object({ email, codigo: z.string().trim().regex(/^\d{6}$/, 'El código tiene 6 números') });
export const googleSchema = z.object({ credential: z.string().min(20).max(4096) });
export const datosCuentaSchema = z.object({
  nombre: texto(120),
  telefono: texto(40),
  calle: texto(120),
  numero: texto(20),
  piso: texto(40),
  ciudad: texto(80),
  provincia: texto(60),
  codigoPostal: texto(12),
});

export type CuentaPublica = {
  email: string;
  nombre: string | null;
  telefono: string | null;
  calle: string | null;
  numero: string | null;
  piso: string | null;
  ciudad: string | null;
  provincia: string | null;
  codigoPostal: string | null;
  conGoogle: boolean;
};

/**
 * Cuentas de compradores de la tienda online. Cada cuenta es un Cliente de la
 * empresa. Se entra con un código que llega por email (o con Google); la sesión
 * es un token opaco que la tienda guarda en una cookie httpOnly.
 */
@Injectable()
export class CuentasTiendaService {
  private readonly logger = new Logger(CuentasTiendaService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @Inject(TIENDA_REPOSITORY) private readonly tienda: TiendaRepository,
  ) {}

  private secreto() {
    return this.config.get('TIENDA_SESIONES_SECRETO', { infer: true }) ?? this.config.get('INTERNAL_WEBHOOK_SECRET', { infer: true });
  }

  private async exigirTienda(empresaId: string) {
    if (!(await this.tienda.empresaActiva(empresaId))) throw new NotFoundException('Tienda no encontrada');
  }

  /** Manda un código de 6 dígitos. Responde lo mismo exista o no la cuenta (no revela qué emails tienen cuenta). */
  async pedirCodigo(empresaId: string, emailNorm: string) {
    await this.exigirTienda(empresaId);
    const ahora = Date.now();
    const recientes = await this.prisma.codigoIngresoTienda.findMany({
      where: { empresaId, email: emailNorm, createdAt: { gte: new Date(ahora - 3_600_000) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (recientes[0] && ahora - recientes[0].createdAt.getTime() < ESPERA_ENTRE_CODIGOS_MS) throw new BadRequestException('Ya te mandamos un código. Esperá un minuto para pedir otro.');
    if (recientes.length >= MAX_CODIGOS_POR_HORA) throw new BadRequestException('Pediste muchos códigos. Probá de nuevo en una hora.');

    const codigo = generarCodigo();
    await this.prisma.codigoIngresoTienda.create({ data: { empresaId, email: emailNorm, codigoHash: hashCodigo(this.secreto(), empresaId, emailNorm, codigo), expira: new Date(ahora + DURACION_CODIGO_MS) } });
    // Limpieza de vez en cuando: los códigos viejos no sirven para nada.
    if (Math.random() < 0.05) void this.prisma.codigoIngresoTienda.deleteMany({ where: { expira: { lt: new Date(ahora - 86_400_000) } } }).catch(() => {});
    await this.enviarCodigo(empresaId, emailNorm, codigo);
    return { enviado: true };
  }

  private async enviarCodigo(empresaId: string, para: string, codigo: string) {
    const clave = this.config.get('RESEND_API_KEY', { infer: true });
    if (!clave) {
      if (process.env.NODE_ENV === 'production') throw new ServiceUnavailableException('El ingreso por email todavía no está disponible');
      this.logger.warn(`[desarrollo, sin RESEND_API_KEY] Código de ingreso para ${para}: ${codigo}`);
      return;
    }
    const tienda = await this.prisma.tiendaConfig.findUnique({ where: { empresaId }, select: { nombre: true } });
    const nombre = tienda?.nombre ?? 'la tienda';
    const desde = this.config.get('AVISOS_EMAIL_DESDE', { infer: true }).replace(/^[^<]*</, `${nombre} <`);
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: desde.includes('<') ? desde : `${nombre} <${desde}>`,
        to: [para],
        subject: `Tu código para entrar a ${nombre}: ${codigo}`,
        text: `Tu código es ${codigo}.\n\nVence en 10 minutos. Si no lo pediste, ignorá este email.`,
      }),
    });
    if (!r.ok) {
      this.logger.error(`Resend respondió ${r.status} al mandar un código`);
      throw new ServiceUnavailableException('No pudimos mandarte el código. Probá de nuevo en unos minutos.');
    }
  }

  async ingresarConCodigo(empresaId: string, emailNorm: string, codigo: string) {
    await this.exigirTienda(empresaId);
    const c = await this.prisma.codigoIngresoTienda.findFirst({ where: { empresaId, email: emailNorm, usado: false, expira: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    const invalido = new UnauthorizedException('El código no es correcto o venció. Pedí uno nuevo.');
    if (!c || c.intentos >= MAX_INTENTOS) throw invalido;
    if (!mismoHash(c.codigoHash, hashCodigo(this.secreto(), empresaId, emailNorm, codigo))) {
      await this.prisma.codigoIngresoTienda.update({ where: { id: c.id }, data: { intentos: { increment: 1 } } });
      throw invalido;
    }
    // Un solo uso, aunque lleguen dos pedidos con el mismo código a la vez.
    const { count } = await this.prisma.codigoIngresoTienda.updateMany({ where: { id: c.id, usado: false }, data: { usado: true } });
    if (count !== 1) throw invalido;
    return this.abrirSesion(empresaId, emailNorm, null);
  }

  async ingresarConGoogle(empresaId: string, credential: string) {
    await this.exigirTienda(empresaId);
    const clientId = this.config.get('GOOGLE_CLIENT_ID_TIENDAS', { infer: true });
    if (!clientId) throw new ServiceUnavailableException('El ingreso con Google no está configurado');
    // Google verifica la firma y el vencimiento del token; acá se chequea que sea para nuestra app.
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const t = (r.ok ? await r.json() : null) as { aud?: string; sub?: string; email?: string; email_verified?: string | boolean; name?: string } | null;
    if (!t || t.aud !== clientId || !t.sub || !t.email || !(t.email_verified === true || t.email_verified === 'true')) throw new UnauthorizedException('No pudimos verificar tu cuenta de Google');
    return this.abrirSesion(empresaId, normalizarEmail(t.email), { sub: t.sub, nombre: t.name ?? null });
  }

  /** Busca o crea la cuenta (y su Cliente) y abre una sesión nueva. */
  private async abrirSesion(empresaId: string, emailNorm: string, google: { sub: string; nombre: string | null } | null) {
    let cuenta = await this.prisma.cuentaTienda.findUnique({ where: { empresaId_email: { empresaId, email: emailNorm } } });
    if (!cuenta) {
      // Si ya era cliente (compró antes o lo cargaron a mano) se usa ese registro; si no, se crea.
      const existente = await this.prisma.cliente.findFirst({
        where: { empresaId, deletedAt: null, email: { equals: emailNorm, mode: 'insensitive' }, cuentaTienda: null },
        orderBy: { createdAt: 'asc' },
      });
      const cliente = existente ?? (await this.prisma.cliente.create({ data: { empresaId, nombre: google?.nombre?.trim() || nombreDesdeEmail(emailNorm), email: emailNorm, etiquetas: ['tienda online'] } }));
      cuenta = await this.prisma.cuentaTienda.create({ data: { empresaId, clienteId: cliente.id, email: emailNorm, googleSub: google?.sub ?? null, nombre: existente?.nombre ?? google?.nombre ?? null, telefono: existente?.telefono ?? null } });
    } else if (google && !cuenta.googleSub) {
      cuenta = await this.prisma.cuentaTienda.update({ where: { id: cuenta.id }, data: { googleSub: google.sub } });
    }
    const token = generarToken();
    await this.prisma.sesionTienda.create({ data: { cuentaId: cuenta.id, tokenHash: hashToken(token), expira: new Date(Date.now() + DURACION_SESION_MS) } });
    await this.prisma.cuentaTienda.update({ where: { id: cuenta.id }, data: { ultimoIngreso: new Date() } });
    return { token, expira: new Date(Date.now() + DURACION_SESION_MS).toISOString(), cuenta: this.publica(cuenta) };
  }

  /** La cuenta de un token de sesión (o 401). La sesión tiene que ser de esta tienda. */
  async cuentaDeSesion(empresaId: string, token: string | undefined) {
    if (!token || token.length < 20 || token.length > 200) throw new UnauthorizedException('Iniciá sesión');
    const s = await this.prisma.sesionTienda.findUnique({ where: { tokenHash: hashToken(token) }, include: { cuenta: true } });
    if (!s || s.expira < new Date() || s.cuenta.empresaId !== empresaId) throw new UnauthorizedException('Tu sesión venció. Volvé a entrar.');
    return s.cuenta;
  }

  /** Para el checkout: la cuenta si hay sesión válida, null si no (no falla: se puede comprar como invitado). */
  async cuentaOpcional(empresaId: string, token: string | undefined) {
    if (!token) return null;
    return this.cuentaDeSesion(empresaId, token).catch(() => null);
  }

  publica(c: { email: string; nombre: string | null; telefono: string | null; calle: string | null; numero: string | null; piso: string | null; ciudad: string | null; provincia: string | null; codigoPostal: string | null; googleSub: string | null }): CuentaPublica {
    return { email: c.email, nombre: c.nombre, telefono: c.telefono, calle: c.calle, numero: c.numero, piso: c.piso, ciudad: c.ciudad, provincia: c.provincia, codigoPostal: c.codigoPostal, conGoogle: Boolean(c.googleSub) };
  }

  async guardarDatos(empresaId: string, token: string | undefined, datos: z.infer<typeof datosCuentaSchema>) {
    const cuenta = await this.cuentaDeSesion(empresaId, token);
    const actualizada = await this.prisma.cuentaTienda.update({ where: { id: cuenta.id }, data: datos });
    // El cliente de la empresa queda con el nombre y teléfono que el comprador mantiene al día.
    await this.prisma.cliente.update({
      where: { id: cuenta.clienteId },
      data: { ...(datos.nombre ? { nombre: datos.nombre } : {}), ...(datos.telefono ? { telefono: datos.telefono } : {}) },
    });
    return this.publica(actualizada);
  }

  async salir(token: string | undefined) {
    if (token) await this.prisma.sesionTienda.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  /** Borra la cuenta, sus sesiones y favoritos. El Cliente y sus pedidos quedan: son registros del negocio. */
  async borrar(empresaId: string, token: string | undefined) {
    const cuenta = await this.cuentaDeSesion(empresaId, token);
    await this.prisma.cuentaTienda.delete({ where: { id: cuenta.id } });
    return { borrada: true };
  }

  async pedidos(empresaId: string, token: string | undefined) {
    const cuenta = await this.cuentaDeSesion(empresaId, token);
    const pedidos = await this.prisma.pedido.findMany({
      // Los de la cuenta y los que hizo antes como invitado con el mismo email (el email está verificado).
      where: { empresaId, OR: [{ clienteId: cuenta.clienteId }, { clienteEmail: { equals: cuenta.email, mode: 'insensitive' } }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { items: { include: { producto: { select: { nombre: true } }, variante: { select: { atributos: true } } } } },
    });
    return pedidos.map((p) => {
      const subtotal = p.items.reduce((a, i) => a + i.cantidad.toNumber() * i.precioUnitario.toNumber(), 0);
      return {
        numero: p.numeroPedido,
        fecha: p.createdAt.toISOString(),
        estado: p.estado,
        numeroSeguimiento: p.numeroSeguimiento,
        transportista: p.transportista,
        subtotal,
        descuentos: p.descuentoCupon.toNumber() + p.descuentoTransferencia.toNumber(),
        total: subtotal - p.descuentoCupon.toNumber() - p.descuentoTransferencia.toNumber(),
        items: p.items.map((i) => ({
          productoId: i.productoId,
          nombre: i.producto.nombre,
          variante: Object.values((i.variante?.atributos ?? {}) as Record<string, string>).filter(Boolean).join(' / ') || null,
          cantidad: i.cantidad.toNumber(),
          precio: i.precioUnitario.toNumber(),
        })),
      };
    });
  }

  async favoritos(empresaId: string, token: string | undefined) {
    const cuenta = await this.cuentaDeSesion(empresaId, token);
    const f = await this.prisma.favoritoTienda.findMany({ where: { cuentaId: cuenta.id }, select: { productoId: true }, orderBy: { createdAt: 'desc' } });
    return f.map((x) => x.productoId);
  }

  async marcarFavorito(empresaId: string, token: string | undefined, productoId: string, marcar: boolean) {
    const cuenta = await this.cuentaDeSesion(empresaId, token);
    if (marcar) {
      const p = await this.prisma.producto.findFirst({ where: { id: productoId, empresaId, deletedAt: null }, select: { id: true } });
      if (!p) throw new NotFoundException('Producto no encontrado');
      await this.prisma.favoritoTienda.upsert({ where: { cuentaId_productoId: { cuentaId: cuenta.id, productoId } }, create: { cuentaId: cuenta.id, productoId }, update: {} });
    } else {
      await this.prisma.favoritoTienda.deleteMany({ where: { cuentaId: cuenta.id, productoId } });
    }
    return this.favoritos(empresaId, token);
  }
}

/** API pública de cuentas de la tienda. La sesión viaja en el header x-sesion-tienda (la tienda la saca de su cookie). */
@Controller('tienda/:empresaId/cuenta')
@Public()
@UseGuards(TiendaThrottlerGuard)
export class CuentasTiendaController {
  constructor(private readonly cuentas: CuentasTiendaService) {}

  @Post('codigo')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  pedirCodigo(@Param('empresaId', new ParseUUIDPipe()) empresaId: string, @Body(new ZodValidationPipe(pedirCodigoSchema)) b: z.infer<typeof pedirCodigoSchema>) {
    return this.cuentas.pedirCodigo(empresaId, b.email);
  }

  @Post('ingresar')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  ingresar(@Param('empresaId', new ParseUUIDPipe()) empresaId: string, @Body(new ZodValidationPipe(ingresarSchema)) b: z.infer<typeof ingresarSchema>) {
    return this.cuentas.ingresarConCodigo(empresaId, b.email, b.codigo);
  }

  @Post('google')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  google(@Param('empresaId', new ParseUUIDPipe()) empresaId: string, @Body(new ZodValidationPipe(googleSchema)) b: z.infer<typeof googleSchema>) {
    return this.cuentas.ingresarConGoogle(empresaId, b.credential);
  }

  @Get()
  async yo(@Param('empresaId', new ParseUUIDPipe()) empresaId: string, @Headers('x-sesion-tienda') token?: string) {
    return this.cuentas.publica(await this.cuentas.cuentaDeSesion(empresaId, token));
  }

  @Patch()
  datos(@Param('empresaId', new ParseUUIDPipe()) empresaId: string, @Headers('x-sesion-tienda') token: string | undefined, @Body(new ZodValidationPipe(datosCuentaSchema)) b: z.infer<typeof datosCuentaSchema>) {
    return this.cuentas.guardarDatos(empresaId, token, b);
  }

  @Post('salir')
  @HttpCode(204)
  async salir(@Headers('x-sesion-tienda') token?: string) {
    await this.cuentas.salir(token);
  }

  @Delete()
  borrar(@Param('empresaId', new ParseUUIDPipe()) empresaId: string, @Headers('x-sesion-tienda') token?: string) {
    return this.cuentas.borrar(empresaId, token);
  }

  @Get('pedidos')
  pedidos(@Param('empresaId', new ParseUUIDPipe()) empresaId: string, @Headers('x-sesion-tienda') token?: string) {
    return this.cuentas.pedidos(empresaId, token);
  }

  @Get('favoritos')
  favoritos(@Param('empresaId', new ParseUUIDPipe()) empresaId: string, @Headers('x-sesion-tienda') token?: string) {
    return this.cuentas.favoritos(empresaId, token);
  }

  @Put('favoritos/:productoId')
  marcar(@Param('empresaId', new ParseUUIDPipe()) empresaId: string, @Param('productoId', new ParseUUIDPipe()) productoId: string, @Headers('x-sesion-tienda') token?: string) {
    return this.cuentas.marcarFavorito(empresaId, token, productoId, true);
  }

  @Delete('favoritos/:productoId')
  desmarcar(@Param('empresaId', new ParseUUIDPipe()) empresaId: string, @Param('productoId', new ParseUUIDPipe()) productoId: string, @Headers('x-sesion-tienda') token?: string) {
    return this.cuentas.marcarFavorito(empresaId, token, productoId, false);
  }
}
