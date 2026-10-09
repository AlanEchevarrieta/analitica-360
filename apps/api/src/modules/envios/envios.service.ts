import { randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UsuarioContext } from '../../common/auth/request-context.types.js';
import { cifrar, descifrar } from '../../common/cifrado.js';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { estadoPedidoDesde, itemsZipnova, leerCodigo, leerCotizacion, NOMBRE_ESTADO, partirDireccion, type OpcionEnvio } from './envios.util.js';
import { ZipnovaCliente, type Credenciales, type Destino } from './zipnova.cliente.js';

export interface ConfigEnviosInput {
  cuentaId: number;
  origenId: number | null;
  /** Vacíos = se mantienen las credenciales guardadas. */
  token: string | null;
  secreto: string | null;
  enTienda: boolean;
  gratisDesde: number | null;
  pesoDefectoGr: number;
}

export interface DestinoEnvio {
  codigoPostal: string;
  localidad: string;
  provincia: string;
}

export interface ProductoACotizar {
  productoId: string;
  cantidad: number;
}

/** Lo que queda guardado en el pedido: la opción que eligió el cliente. */
export interface OpcionGuardada {
  codigo: string;
  transportista: string;
  servicio: string;
  precio: number;
}

/** Envíos con Zipnova: conexión de cada empresa, cotización en la tienda, envío del pedido, etiqueta y estados. */
@Injectable()
export class EnviosService {
  private readonly logger = new Logger('Envios');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly zipnova: ZipnovaCliente,
  ) {}

  private get clave(): string | undefined {
    return this.config.get('CLAVE_CIFRADO', { infer: true });
  }

  async estado(empresaId: string) {
    const c = await this.prisma.envioConfig.findUnique({ where: { empresaId } });
    const api = this.config.get('API_URL_PUBLICA', { infer: true });
    return {
      disponible: Boolean(this.clave),
      config: c && {
        proveedor: c.proveedor,
        cuentaId: c.cuentaId,
        origenId: c.origenId,
        enTienda: c.enTienda,
        gratisDesde: c.gratisDesde == null ? null : Number(c.gratisDesde),
        pesoDefectoGr: c.pesoDefectoGr,
        verificadoEn: c.verificadoEn,
        // Va en Zipnova → Configuración → Webhooks (tópico "status"); la clave identifica a la empresa.
        urlAvisos: api ? `${api}/webhooks/zipnova/${c.avisoClave}` : null,
      },
    };
  }

  async guardar(empresaId: string, usuario: UsuarioContext, input: ConfigEnviosInput) {
    if (usuario.rol !== 'dueno') throw new ForbiddenException('Solo el dueño puede conectar los envíos');
    const clave = this.exigirClave();
    const actual = await this.prisma.envioConfig.findUnique({ where: { empresaId } });
    let cred: Credenciales;
    if (input.token && input.secreto) cred = { token: input.token, secreto: input.secreto };
    else if (actual) cred = this.credenciales(actual.credenciales);
    else throw new BadRequestException('Pegá el token y el secreto de la API de Zipnova');

    await this.zipnova.verificar(cred, input.cuentaId);
    const datos = {
      cuentaId: input.cuentaId,
      origenId: input.origenId,
      credenciales: cifrar(JSON.stringify(cred), clave),
      enTienda: input.enTienda,
      gratisDesde: input.gratisDesde,
      pesoDefectoGr: input.pesoDefectoGr,
      verificadoEn: new Date(),
    };
    await this.prisma.envioConfig.upsert({
      where: { empresaId },
      create: { empresaId, ...datos, avisoClave: randomBytes(24).toString('base64url') },
      update: datos,
    });
    return this.estado(empresaId);
  }

  async desconectar(empresaId: string, usuario: UsuarioContext): Promise<void> {
    if (usuario.rol !== 'dueno') throw new ForbiddenException('Solo el dueño puede desconectar los envíos');
    await this.prisma.envioConfig.deleteMany({ where: { empresaId } });
  }

  /** Para el checkout de la tienda. Sin envíos conectados (o apagados en la tienda) no hay opciones: queda "a coordinar". */
  async cotizar(empresaId: string, destino: DestinoEnvio, productos: ProductoACotizar[], subtotal: number): Promise<{ opciones: OpcionEnvio[] }> {
    const c = await this.prisma.envioConfig.findUnique({ where: { empresaId } });
    if (!c?.enTienda || !c.verificadoEn || !this.clave) return { opciones: [] };
    const respuesta = await this.zipnova.cotizar(this.credenciales(c.credenciales), {
      cuentaId: c.cuentaId,
      origenId: c.origenId,
      valor: subtotal,
      destino: { city: destino.localidad, state: destino.provincia, zipcode: destino.codigoPostal },
      items: await this.items(empresaId, productos, c.pesoDefectoGr),
    });
    const opciones = leerCotizacion(respuesta);
    // Envío gratis desde cierto monto: la opción más barata sale $0 (el comercio paga ese envío).
    if (opciones.length > 0 && c.gratisDesde != null && subtotal >= Number(c.gratisDesde)) opciones[0] = { ...opciones[0], precio: 0 };
    return { opciones };
  }

  /** Al confirmar el pedido: se vuelve a cotizar en el servidor (el precio que manda el navegador no vale). */
  async opcionElegida(empresaId: string, codigo: string, destino: DestinoEnvio, productos: ProductoACotizar[], subtotal: number): Promise<OpcionGuardada> {
    const { opciones } = await this.cotizar(empresaId, destino, productos, subtotal);
    const o = opciones.find((x) => x.codigo === codigo);
    if (!o) throw new BadRequestException('Esa forma de envío ya no está disponible: volvé a elegir el envío');
    return { codigo: o.codigo, transportista: o.transportista, servicio: o.servicio, precio: o.precio };
  }

  /**
   * Crea el envío en Zipnova para el pedido (una sola vez) y deja transportista y seguimiento en el pedido.
   * Lo que cobra Zipnova queda como gasto de logística (variable): con la venta, que suma lo que pagó el
   * cliente, la caja y la ganancia dan bien (y con envío gratis, se ve lo que cuesta).
   */
  async crearEnvio(empresaId: string, pedidoId: string, usuarioId: string | null = null) {
    const c = await this.configConectada(empresaId);
    return this.prisma.$transaction(
      async (tx) => {
        // Dos clics a la vez no crean dos envíos (que se pagan).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'envio:' + pedidoId}))`;
        const p = await tx.pedido.findFirst({ where: { id: pedidoId, empresaId }, include: { items: true } });
        if (!p) throw new NotFoundException('Pedido no encontrado');
        if (p.envioId) throw new ConflictException('Este pedido ya tiene su envío creado');
        if (p.estado === 'cancelado' || p.estado === 'entregado') throw new BadRequestException('El pedido está cancelado o ya entregado');
        if (!p.direccionEnvio || !p.codigoPostal || !p.localidad || !p.provincia) {
          throw new BadRequestException('Completá la dirección, el código postal, la localidad y la provincia del pedido');
        }
        const productos = p.items.map((i) => ({ productoId: i.productoId, cantidad: Math.max(1, Math.round(i.cantidad.toNumber())) }));
        const valor = Math.round(p.items.reduce((a, i) => a + i.cantidad.toNumber() * i.precioUnitario.toNumber(), 0));
        const destino: DestinoEnvio = { codigoPostal: p.codigoPostal, localidad: p.localidad, provincia: p.provincia };
        const cred = this.credenciales(c.credenciales);
        const items = await this.items(empresaId, productos, c.pesoDefectoGr, tx);

        // La opción que eligió el cliente en la tienda; en un pedido manual, la más barata.
        let codigo = (p.envioOpcion as OpcionGuardada | null)?.codigo ?? null;
        if (!codigo) {
          const opciones = leerCotizacion(
            await this.zipnova.cotizar(cred, { cuentaId: c.cuentaId, origenId: c.origenId, valor, destino: { city: destino.localidad, state: destino.provincia, zipcode: destino.codigoPostal }, items }),
          );
          if (opciones.length === 0) throw new BadRequestException('Zipnova no tiene opciones de envío a ese destino');
          codigo = opciones[0].codigo;
        }
        const opcion = leerCodigo(codigo);
        if (!opcion) throw new BadRequestException('La forma de envío guardada en el pedido no es válida');

        const dest: Destino = {
          name: p.clienteNombre ?? undefined,
          email: p.clienteEmail ?? undefined,
          phone: p.clienteTelefono ?? undefined,
          ...partirDireccion(p.direccionEnvio),
          city: p.localidad,
          state: p.provincia,
          zipcode: p.codigoPostal,
        };
        const envio = await this.zipnova.crear(cred, { cuentaId: c.cuentaId, origenId: c.origenId, referencia: p.numeroPedido, valor, destino: dest, items, ...opcion });
        await tx.pedido.update({
          where: { id: p.id },
          data: { envioId: String(envio.id), envioEstado: envio.status, transportista: envio.carrier ?? p.transportista, numeroSeguimiento: envio.seguimiento ?? p.numeroSeguimiento },
        });
        if (envio.precio && envio.precio > 0) {
          await tx.gasto.create({
            data: {
              empresaId,
              usuarioId,
              categoria: 'logistica',
              descripcion: `Envío del pedido ${p.numeroPedido}${envio.carrier ? ` (${envio.carrier})` : ''}`,
              monto: envio.precio,
              fecha: new Date(`${fechaHoyAR()}T00:00:00Z`),
              tipoCosto: 'variable',
            },
          });
        }
        return { ...this.resumen(String(envio.id), envio.status), costo: envio.precio };
      },
      { timeout: 45_000 },
    );
  }

  async etiqueta(empresaId: string, pedidoId: string): Promise<{ pdf: Buffer; nombre: string }> {
    const c = await this.configConectada(empresaId);
    const p = await this.pedidoConEnvio(empresaId, pedidoId);
    return { pdf: await this.zipnova.etiqueta(this.credenciales(c.credenciales), p.envioId), nombre: `etiqueta-${p.numeroPedido}.pdf` };
  }

  /** Consulta el estado en Zipnova y mueve el pedido (con el transportista / entregado). */
  async actualizar(empresaId: string, pedidoId: string) {
    const c = await this.configConectada(empresaId);
    const p = await this.pedidoConEnvio(empresaId, pedidoId);
    const envio = await this.zipnova.envio(this.credenciales(c.credenciales), p.envioId);
    await this.aplicarEstado(p.id, p.estado, envio.status, envio.seguimiento);
    return this.resumen(p.envioId, envio.status);
  }

  /**
   * Aviso de Zipnova. No viene firmado: la clave de la URL dice de qué empresa es, y el estado no se toma del
   * aviso sino que se le pregunta a Zipnova con las credenciales de la empresa. Siempre responde bien (para
   * que no reintente) salvo que la clave no exista.
   */
  async aviso(clave: string, cuerpo: unknown): Promise<boolean> {
    const c = await this.prisma.envioConfig.findUnique({ where: { avisoClave: clave } });
    if (!c) return false;
    const b = cuerpo as { id?: unknown; shipment_id?: unknown; shipment?: { id?: unknown }; data?: { id?: unknown } } | null;
    const id = [b?.shipment_id, b?.shipment?.id, b?.data?.id, b?.id].find((x) => typeof x === 'number' || (typeof x === 'string' && /^\d{1,15}$/.test(x)));
    if (id == null) return true;
    const p = await this.prisma.pedido.findFirst({ where: { empresaId: c.empresaId, envioId: String(id) }, select: { id: true, estado: true } });
    if (!p) return true;
    try {
      const envio = await this.zipnova.envio(this.credenciales(c.credenciales), String(id));
      await this.aplicarEstado(p.id, p.estado, envio.status, envio.seguimiento);
    } catch (e) {
      this.logger.warn(`Aviso de Zipnova sin procesar (envío ${String(id)}): ${String(e)}`);
    }
    return true;
  }

  private async aplicarEstado(pedidoId: string, estadoPedido: string, estadoZipnova: string | null, seguimiento: string | null) {
    const destino = estadoPedidoDesde(estadoZipnova);
    // Solo hacia adelante y desde un pedido ya despachado (el despacho registra la venta: eso lo hace una persona).
    const puede = (destino === 'con_transportista' && estadoPedido === 'despachado') || (destino === 'entregado' && (estadoPedido === 'despachado' || estadoPedido === 'con_transportista'));
    await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: { envioEstado: estadoZipnova, ...(seguimiento ? { numeroSeguimiento: seguimiento } : {}), ...(puede ? { estado: destino! } : {}) },
    });
  }

  private resumen(id: string, estado: string | null) {
    return { id, estado, estadoNombre: estado ? (NOMBRE_ESTADO[estado] ?? estado) : null };
  }

  private async pedidoConEnvio(empresaId: string, pedidoId: string) {
    const p = await this.prisma.pedido.findFirst({ where: { id: pedidoId, empresaId }, select: { id: true, estado: true, envioId: true, numeroPedido: true } });
    if (!p) throw new NotFoundException('Pedido no encontrado');
    if (!p.envioId) throw new BadRequestException('Este pedido todavía no tiene envío');
    return { ...p, envioId: p.envioId };
  }

  private async configConectada(empresaId: string) {
    this.exigirClave();
    const c = await this.prisma.envioConfig.findUnique({ where: { empresaId } });
    if (!c?.verificadoEn) throw new BadRequestException('Conectá tu cuenta de Zipnova en Configuración → Envíos');
    return c;
  }

  private exigirClave(): string {
    const clave = this.clave;
    if (!clave) throw new ServiceUnavailableException('Los envíos todavía no están habilitados en Analítica 360');
    return clave;
  }

  private credenciales(cifrado: string): Credenciales {
    return JSON.parse(descifrar(cifrado, this.exigirClave())) as Credenciales;
  }

  private async items(empresaId: string, productos: ProductoACotizar[], pesoDefectoGr: number, db: Pick<PrismaService, 'producto'> = this.prisma) {
    const datos = await db.producto.findMany({
      where: { empresaId, id: { in: [...new Set(productos.map((p) => p.productoId))] } },
      select: { id: true, nombre: true, pesoGr: true, altoCm: true, anchoCm: true, largoCm: true },
    });
    const porId = new Map(datos.map((d) => [d.id, d]));
    const num = (v: { toNumber(): number } | null) => (v == null ? null : v.toNumber());
    return itemsZipnova(
      productos.map((p) => {
        const d = porId.get(p.productoId);
        return { cantidad: p.cantidad, nombre: d?.nombre, pesoGr: num(d?.pesoGr ?? null), altoCm: num(d?.altoCm ?? null), anchoCm: num(d?.anchoCm ?? null), largoCm: num(d?.largoCm ?? null) };
      }),
      pesoDefectoGr,
    );
  }
}
