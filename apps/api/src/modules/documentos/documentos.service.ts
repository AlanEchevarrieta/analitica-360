import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import sharp from 'sharp';
import { AlmacenArchivosService } from '../../common/archivos/almacen-archivos.service.js';
import { optimizarImagen } from '../../common/archivos/optimizar-imagen.js';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { VentasService } from '../ventas/ventas.service.js';
import { pdfDocumento, type DatosDocumentoPdf, type NegocioDoc } from './documento.pdf.js';
import {
  DIAS_LINK,
  LEYENDA_NO_FACTURA,
  mensajeWhatsApp,
  nombreArchivo,
  nombrePago,
  numeroDocumento,
  telefonoWhatsApp,
  TITULO,
  tokenDocumento,
  leerTokenDocumento,
  type TipoDocumento,
} from './documentos.util.js';

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const plata = (simbolo: string, n: number) => `${simbolo} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface DocumentoArmado {
  tipo: TipoDocumento;
  numero: string;
  archivo: string;
  pdf: Buffer;
  total: number;
  simbolo: string;
  negocio: string;
  /** Email del negocio: las respuestas del cliente van ahí. */
  emailNegocio: string | null;
  cliente: { nombre: string | null; telefono: string | null; email: string | null } | null;
}

/** Arma las piezas de un documento (lo que el PDF necesita y a quién mandarlo). */
export type ArmadorDocumento = (
  empresaId: string,
  id: string,
) => Promise<Omit<DatosDocumentoPdf, 'negocio' | 'pie' | 'leyenda' | 'simbolo'> & { tipo: TipoDocumento; totalNumero: number; /** Otra moneda (presupuesto en dólares, reales…). */ simbolo?: string }>;

/**
 * Documentos que no son factura: comprobante de venta y recibo de cobro (el
 * presupuesto se suma con PresupuestosService). PDF con el logo y los datos
 * del negocio, y envío por email o por WhatsApp con un link firmado.
 */
@Injectable()
export class DocumentosService {
  private readonly logger = new Logger('Documentos');
  private readonly armadores = new Map<TipoDocumento, ArmadorDocumento>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: ConfigService<Env, true>,
    private readonly almacen: AlmacenArchivosService,
    private readonly ventas: VentasService,
  ) {
    this.armadores.set('venta', (e, id) => this.datosVenta(e, id));
    this.armadores.set('recibo', (e, id) => this.datosRecibo(e, id));
  }

  /** Otro módulo (presupuestos) registra cómo se arma su documento. */
  registrar(tipo: TipoDocumento, armador: ArmadorDocumento) {
    this.armadores.set(tipo, armador);
  }

  // ---- Configuración ----------------------------------------------------

  async config(empresaId: string) {
    const [c, tienda] = await Promise.all([
      this.prisma.documentosConfig.findUnique({ where: { empresaId } }),
      this.prisma.tiendaConfig.findUnique({ where: { empresaId }, select: { logoUrl: true } }),
    ]);
    return {
      logoUrl: c?.logoUrl ?? null,
      logoTienda: tienda?.logoUrl ?? null,
      pie: c?.pie ?? null,
      validezPresupuestoDias: c?.validezPresupuestoDias ?? 15,
    };
  }

  async guardarConfig(empresaId: string, datos: { pie?: string | null; validezPresupuestoDias?: number }) {
    await this.prisma.documentosConfig.upsert({
      where: { empresaId },
      create: { empresaId, pie: datos.pie ?? null, validezPresupuestoDias: datos.validezPresupuestoDias ?? 15 },
      update: { pie: datos.pie, validezPresupuestoDias: datos.validezPresupuestoDias },
    });
    return this.config(empresaId);
  }

  async subirLogo(empresaId: string, archivo: { buffer: Buffer; size: number } | undefined) {
    if (!archivo?.buffer?.length) throw new BadRequestException('Elegí una imagen');
    if (archivo.size > 15 * 1024 * 1024) throw new BadRequestException('La imagen pesa más de 15 MB');
    let optimizada: Buffer;
    try {
      optimizada = await optimizarImagen(archivo.buffer, 600, 90);
    } catch {
      throw new BadRequestException('No se pudo leer la imagen: probá con otra');
    }
    const { url } = await this.almacen.guardar(empresaId, optimizada, 'webp');
    const anterior = await this.prisma.documentosConfig.findUnique({ where: { empresaId }, select: { logoUrl: true } });
    await this.prisma.documentosConfig.upsert({ where: { empresaId }, create: { empresaId, logoUrl: url }, update: { logoUrl: url } });
    await this.borrarArchivo(empresaId, anterior?.logoUrl ?? null);
    return this.config(empresaId);
  }

  async quitarLogo(empresaId: string) {
    const anterior = await this.prisma.documentosConfig.findUnique({ where: { empresaId }, select: { logoUrl: true } });
    if (anterior) await this.prisma.documentosConfig.update({ where: { empresaId }, data: { logoUrl: null } });
    await this.borrarArchivo(empresaId, anterior?.logoUrl ?? null);
    return this.config(empresaId);
  }

  private async borrarArchivo(empresaId: string, url: string | null) {
    const clave = url?.split('/').slice(-2).join('/');
    if (clave?.startsWith(`${empresaId}/`)) await this.almacen.borrar(clave);
  }

  // ---- Armado ------------------------------------------------------------

  /** Encabezado: nombre, CUIT, dirección, teléfono y email (los del remitente) y el logo en PNG. */
  async negocio(empresaId: string): Promise<{ negocio: NegocioDoc; pie: string | null; simbolo: string }> {
    const [empresa, conf, docs, tienda] = await Promise.all([
      this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true, cuit: true, telefono: true } }),
      this.prisma.configuracionEmpresa.findUnique({ where: { empresaId }, select: { inventario: true, simboloMoneda: true } }),
      this.prisma.documentosConfig.findUnique({ where: { empresaId } }),
      this.prisma.tiendaConfig.findUnique({ where: { empresaId }, select: { logoUrl: true } }),
    ]);
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    const inv = (conf?.inventario ?? {}) as Record<string, unknown>;
    const original = await this.almacen.leerDeUrl(empresaId, docs?.logoUrl ?? tienda?.logoUrl ?? null);
    const logo = original ? await sharp(original).png().toBuffer().catch(() => null) : null;
    return {
      negocio: {
        nombre: texto(inv.remitente_nombre) ?? empresa.nombre,
        cuit: empresa.cuit,
        direccion: texto(inv.remitente_direccion),
        telefono: texto(inv.remitente_telefono) ?? empresa.telefono,
        email: texto(inv.remitente_email),
        logo,
      },
      pie: docs?.pie ?? null,
      simbolo: conf?.simboloMoneda ?? '$',
    };
  }

  async armar(empresaId: string, tipo: TipoDocumento, id: string): Promise<DocumentoArmado> {
    const armador = this.armadores.get(tipo);
    if (!armador) throw new NotFoundException('Tipo de documento desconocido');
    const [datos, cabecera] = await Promise.all([armador(empresaId, id), this.negocio(empresaId)]);
    const { tipo: _t, totalNumero, simbolo: otraMoneda, ...resto } = datos;
    const simbolo = otraMoneda ?? cabecera.simbolo;
    const pdf = await pdfDocumento({ ...resto, negocio: cabecera.negocio, pie: cabecera.pie, leyenda: LEYENDA_NO_FACTURA, simbolo });
    return { tipo, numero: datos.numero, archivo: nombreArchivo(tipo, datos.numero), pdf, total: totalNumero, simbolo, negocio: cabecera.negocio.nombre, emailNegocio: cabecera.negocio.email, cliente: datos.cliente };
  }

  private async simbolo(empresaId: string) {
    return (await this.prisma.configuracionEmpresa.findUnique({ where: { empresaId }, select: { simboloMoneda: true } }))?.simboloMoneda ?? '$';
  }

  private async datosVenta(empresaId: string, id: string) {
    const [v, simbolo] = await Promise.all([this.ventas.ficha(empresaId, id), this.simbolo(empresaId)]);
    if (v.anulada) throw new BadRequestException('La venta está anulada: no se puede generar el comprobante');
    const cliente = v.clienteId ? await this.prisma.cliente.findFirst({ where: { id: v.clienteId, empresaId }, select: { nombre: true, telefono: true, email: true } }) : null;
    const items = v.items.map((i) => ({ descripcion: i.varianteEtiqueta ? `${i.productoNombre} (${i.varianteEtiqueta})` : i.productoNombre, cantidad: i.cantidad, precio: i.precioUnitario }));
    const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
    const resumen: { etiqueta: string; monto: number }[] = [];
    if (v.descuento > 0 || v.costoEnvio > 0 || Math.abs(subtotal - v.total) > 0.009) resumen.push({ etiqueta: 'Subtotal', monto: subtotal });
    if (v.descuento > 0) resumen.push({ etiqueta: 'Descuento', monto: -v.descuento });
    if (v.costoEnvio > 0) resumen.push({ etiqueta: 'Envío', monto: v.costoEnvio });
    const interes = v.total - (subtotal - v.descuento + v.costoEnvio);
    if (interes > 0.009) resumen.push({ etiqueta: `Interés (${v.cuotas} cuotas)`, monto: interes });
    const detalles = [`Forma de pago: ${nombrePago(v.formaPago)}${v.cuotas > 1 ? ` en ${v.cuotas} cuotas` : ''}`];
    if (v.saldoPendiente > 0) detalles.push(`Pagado: ${plata(simbolo, v.total - v.saldoPendiente)} · Saldo pendiente: ${plata(simbolo, v.saldoPendiente)}`);
    return {
      tipo: 'venta' as const,
      titulo: TITULO.venta,
      numero: v.numeroVenta ?? v.id.slice(0, 8).toUpperCase(),
      fecha: v.fecha.toISOString(),
      extras: [],
      cliente: { nombre: cliente?.nombre ?? v.clienteNombre, telefono: cliente?.telefono ?? null, email: cliente?.email ?? null },
      items,
      resumen,
      total: { etiqueta: 'Total', monto: v.total },
      totalNumero: v.total,
      detalles,
      notas: null,
    };
  }

  private async datosRecibo(empresaId: string, id: string) {
    const cobro = await this.prisma.cobroCliente.findFirst({
      where: { id, empresaId },
      include: { cliente: { select: { nombre: true, telefono: true, email: true } }, aplicaciones: { include: { venta: { select: { numeroVenta: true, clienteNombre: true } } } } },
    });
    if (!cobro) throw new NotFoundException('Cobro no encontrado');
    const simbolo = await this.simbolo(empresaId);
    if (cobro.anuladoAt) throw new BadRequestException('El cobro está anulado: no se puede generar el recibo');
    const numero = cobro.numeroRecibo ?? (await this.asignarNumeroRecibo(empresaId, id));
    const monto = cobro.monto.toNumber();
    const aplicado = cobro.aplicaciones.reduce((s, a) => s + a.monto.toNumber(), 0);
    const ventas = cobro.aplicaciones.map((a) => a.venta.numeroVenta).filter(Boolean);
    const detalles = [`Forma de pago: ${nombrePago(cobro.formaPago)}`];
    if (ventas.length) detalles.push(`A cuenta de: ${ventas.join(', ')}`);
    if (monto - aplicado > 0.009) detalles.push(`Queda a favor: ${plata(simbolo, monto - aplicado)}`);
    const nombre = cobro.cliente?.nombre ?? cobro.aplicaciones[0]?.venta.clienteNombre ?? null;
    return {
      tipo: 'recibo' as const,
      titulo: TITULO.recibo,
      numero: numeroDocumento('R', numero),
      fecha: cobro.fecha.toISOString(),
      extras: [],
      cliente: { nombre, telefono: cobro.cliente?.telefono ?? null, email: cobro.cliente?.email ?? null },
      items: null,
      resumen: [],
      total: { etiqueta: 'Recibimos', monto },
      totalNumero: monto,
      detalles,
      notas: cobro.notas,
    };
  }

  /** El número se asigna la primera vez que se pide el recibo (los cobros viejos también lo reciben). */
  private async asignarNumeroRecibo(empresaId: string, id: string): Promise<number> {
    for (let intento = 0; intento < 3; intento++) {
      try {
        const [fila] = await this.prisma.$queryRaw<{ numero_recibo: number | null }[]>`
          UPDATE cobros_clientes SET numero_recibo = (SELECT COALESCE(MAX(numero_recibo), 0) + 1 FROM cobros_clientes WHERE empresa_id = ${empresaId}::uuid)
          WHERE id = ${id}::uuid AND empresa_id = ${empresaId}::uuid AND numero_recibo IS NULL
          RETURNING numero_recibo`;
        if (fila?.numero_recibo) return fila.numero_recibo;
        const ya = await this.prisma.cobroCliente.findFirst({ where: { id, empresaId }, select: { numeroRecibo: true } });
        if (ya?.numeroRecibo) return ya.numeroRecibo;
      } catch (e) {
        // Dos recibos a la vez pueden pedir el mismo número: se reintenta.
        if (!(e instanceof Prisma.PrismaClientKnownRequestError) && !String(e).includes('numero_recibo')) throw e;
      }
    }
    throw new ServiceUnavailableException('No se pudo numerar el recibo. Probá de nuevo.');
  }

  /** Cobros de saldo de una venta (cada uno tiene su recibo). */
  async cobrosDeVenta(empresaId: string, ventaId: string) {
    const filas = await this.prisma.cobroAplicacion.findMany({
      where: { ventaId, venta: { empresaId }, cobro: { anuladoAt: null } },
      include: { cobro: { select: { id: true, fecha: true, monto: true, formaPago: true, numeroRecibo: true } } },
      orderBy: { cobro: { fecha: 'asc' } },
    });
    return filas.map((f) => ({ id: f.cobro.id, fecha: f.cobro.fecha.toISOString(), monto: f.cobro.monto.toNumber(), formaPago: f.cobro.formaPago, recibo: f.cobro.numeroRecibo ? numeroDocumento('R', f.cobro.numeroRecibo) : null }));
  }

  // ---- Envío -------------------------------------------------------------

  /** Link público al PDF (vale 60 días) y el mensaje para mandarlo por WhatsApp. */
  async link(empresaId: string, tipo: TipoDocumento, id: string) {
    const d = await this.armar(empresaId, tipo, id);
    const vence = new Date(Date.parse(`${fechaHoyAR()}T00:00:00Z`) + DIAS_LINK * 86_400_000).toISOString().slice(0, 10);
    const url = `${this.urlApi()}/documentos/ver/${tokenDocumento(this.secreto(), empresaId, tipo, id, vence)}`;
    const total = `${d.simbolo} ${d.total.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
    const mensaje = mensajeWhatsApp({ tipo, numero: d.numero, cliente: d.cliente?.nombre ?? null, negocio: d.negocio, total, url });
    const telefono = telefonoWhatsApp(d.cliente?.telefono);
    return { url, vence, mensaje, telefono, whatsapp: `https://wa.me/${telefono ?? ''}?text=${encodeURIComponent(mensaje)}` };
  }

  /** PDF desde el link público (sin sesión). */
  async publico(token: string): Promise<DocumentoArmado> {
    const t = leerTokenDocumento(this.secreto(), token, fechaHoyAR());
    if (!t) throw new NotFoundException('El link no es válido o ya venció. Pedile al comercio que te lo mande de nuevo.');
    return this.armar(t.empresaId, t.tipo, t.id);
  }

  async email(empresaId: string, tipo: TipoDocumento, id: string, email: string | null) {
    const clave = this.env.get('RESEND_API_KEY', { infer: true });
    if (!clave) throw new ServiceUnavailableException('El envío de emails todavía no está configurado. Mientras tanto mandalo por WhatsApp o descargá el PDF.');
    const d = await this.armar(empresaId, tipo, id);
    const para = (email ?? d.cliente?.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para)) throw new BadRequestException(d.cliente?.email ? 'El email no es válido' : 'El cliente no tiene email: escribilo para mandarlo');
    const titulo = `${TITULO[tipo]} ${d.numero}`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${d.negocio.replace(/[<>"]/g, '')} <${this.remitenteEmail()}>`,
        to: [para],
        ...(d.emailNegocio ? { reply_to: d.emailNegocio } : {}),
        subject: `${titulo} · ${d.negocio}`,
        text: `Hola${d.cliente?.nombre ? ` ${d.cliente.nombre.split(' ')[0]}` : ''}:\n\nTe mandamos ${TITULO[tipo].toLowerCase()} ${d.numero} (${dmy(fechaHoyAR())}) en el PDF adjunto.\n\n${d.negocio}`,
        attachments: [{ filename: d.archivo, content: d.pdf.toString('base64') }],
      }),
    });
    if (!r.ok) {
      this.logger.warn(`Resend respondió ${r.status} al mandar ${titulo}`);
      throw new ServiceUnavailableException('No se pudo mandar el email. Probá de nuevo en unos minutos.');
    }
    return { para };
  }

  /** La dirección de AVISOS_EMAIL_DESDE (puede venir como "Nombre <dir>"). */
  private remitenteEmail() {
    const desde = this.env.get('AVISOS_EMAIL_DESDE', { infer: true }) ?? '';
    return desde.match(/<([^>]+)>/)?.[1] ?? desde;
  }

  private secreto() {
    return this.env.get('CLERK_SECRET_KEY', { infer: true });
  }

  private urlApi() {
    return (this.env.get('API_URL_PUBLICA', { infer: true }) ?? `http://localhost:${this.env.get('PORT', { infer: true })}`).replace(/\/$/, '');
  }
}
