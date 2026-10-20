import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Env } from '../../config/env.validation.js';
import type { UsuarioContext } from '../../common/auth/request-context.types.js';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { ArcaCliente } from './arca.cliente.js';
import { CONDICION_IVA, cuitValido, DOC, NOMBRE_TIPO, numeroCompleto, TIPO, type DatosComprobante } from './arca.util.js';
import { asuntoFactura, htmlFactura, textoFactura } from './factura.email.js';
import { pdfFactura } from './factura.pdf.js';

export interface ConfigFacturacionInput {
  cuit: string;
  razonSocial: string;
  domicilio: string;
  inicioActividades: string | null;
  iibb: string | null;
  puntoVenta: number;
}

export interface ReceptorInput {
  docTipo: 80 | 96 | 99;
  docNro: string;
  nombre: string | null;
  condicionIva: 1 | 4 | 5 | 6;
}

const fecha = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
const sinGuiones = (s: string) => s.replace(/\D/g, '');

/** Mensajes de ARCA frecuentes, en palabras del comercio. */
function explicar(errores: string[]): string {
  const t = errores.join(' · ');
  if (/no autorizado|not authorized|600|cuit representada/i.test(t)) return `ARCA no autoriza a facturar con este CUIT: falta delegar el servicio de factura electrónica a Analítica 360 o el punto de venta no es "Web Services". (${t})`;
  if (/punto de venta/i.test(t)) return `El punto de venta no es válido para factura electrónica por web services. (${t})`;
  return `ARCA rechazó el comprobante: ${t}`;
}

/**
 * Factura C (monotributo) y nota de crédito C con ARCA. Cada empresa factura con su CUIT; la
 * firma la pone Analítica 360 como proveedor (la empresa le delegó el servicio "wsfe").
 */
@Injectable()
export class FacturacionService {
  private readonly logger = new Logger('Facturacion');

  constructor(
    private readonly prisma: PrismaService,
    private readonly arca: ArcaCliente,
    private readonly config_: ConfigService<Env, true>,
  ) {}

  async estado(empresaId: string) {
    const c = await this.prisma.arcaConfig.findUnique({ where: { empresaId } });
    return {
      disponible: this.arca.configurado,
      ambiente: this.arca.ambiente,
      config: c ? { cuit: c.cuit, razonSocial: c.razonSocial, domicilio: c.domicilio, inicioActividades: fecha(c.inicioActividades), iibb: c.iibb, puntoVenta: c.puntoVenta, verificadoEn: c.verificadoEn } : null,
    };
  }

  async guardarConfig(empresaId: string, usuario: UsuarioContext, input: ConfigFacturacionInput) {
    if (usuario.rol !== 'dueno') throw new ForbiddenException('Solo el dueño puede configurar la factura electrónica');
    const cuit = sinGuiones(input.cuit);
    if (!cuitValido(cuit)) throw new BadRequestException('El CUIT no es válido');
    const datos = {
      cuit,
      razonSocial: input.razonSocial.trim(),
      domicilio: input.domicilio.trim(),
      inicioActividades: input.inicioActividades ? new Date(`${input.inicioActividades}T00:00:00Z`) : null,
      iibb: input.iibb?.trim() || null,
      puntoVenta: input.puntoVenta,
      verificadoEn: null, // cambió algo: hay que volver a comprobar
    };
    await this.prisma.arcaConfig.upsert({ where: { empresaId }, create: { empresaId, ...datos }, update: datos });
    return this.estado(empresaId);
  }

  private async config(empresaId: string) {
    const c = await this.prisma.arcaConfig.findUnique({ where: { empresaId } });
    if (!c) throw new BadRequestException('Primero cargá los datos de facturación en Configuración → Impuestos y facturación');
    return c;
  }

  /** Comprueba que ARCA acepta facturar con este CUIT y punto de venta (la delegación está hecha). */
  async verificar(empresaId: string, usuario: UsuarioContext) {
    if (usuario.rol !== 'dueno') throw new ForbiddenException('Solo el dueño puede verificar la factura electrónica');
    const c = await this.config(empresaId);
    if (!(await this.arca.funciona())) throw new ServiceUnavailableException('Los servidores de ARCA no están funcionando ahora. Probá más tarde.');
    try {
      const ultimo = await this.arca.ultimoAutorizado(c.cuit, c.puntoVenta, TIPO.FACTURA_C);
      await this.prisma.arcaConfig.update({ where: { empresaId }, data: { verificadoEn: new Date() } });
      return { ok: true, ultimoNumero: ultimo };
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      throw new BadRequestException(explicar([(e as Error).message]));
    }
  }

  private async totalVenta(ventaId: string, empresaId: string) {
    const v = await this.prisma.venta.findFirst({
      where: { id: ventaId, empresaId },
      include: { items: { include: { producto: { select: { nombre: true } } } } },
    });
    if (!v) throw new NotFoundException('Venta no encontrada');
    const items = v.items.map((i) => ({ descripcion: i.producto.nombre, cantidad: Number(i.cantidad), precio: i.precioUnitario.toNumber() }));
    const sumaItems = items.reduce((t, i) => t + i.cantidad * i.precio, 0);
    const total = v.totalConInteres?.toNumber() || v.totalSinInteres?.toNumber() || sumaItems - v.descuento.toNumber();
    return { venta: v, items, total: Math.round(total * 100) / 100 };
  }

  /**
   * Pide el CAE con el número siguiente. Un candado por empresa y punto de venta evita que dos
   * comprobantes a la vez pidan el mismo número (ARCA rechazaría el segundo).
   */
  private async emitir(empresaId: string, c: { cuit: string; puntoVenta: number }, datos: Omit<DatosComprobante, 'numero' | 'puntoVenta'>, guardar: { ventaId: string | null; asociadoId: string | null; receptorNombre: string | null; usuarioId: string }) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`arca:${empresaId}:${c.puntoVenta}`}))`);
        const numero = (await this.arca.ultimoAutorizado(c.cuit, c.puntoVenta, datos.tipo)) + 1;
        const r = await this.arca.solicitarCAE(c.cuit, { ...datos, numero, puntoVenta: c.puntoVenta });
        if (!r.aprobado) throw new BadRequestException(explicar(r.errores));
        return tx.comprobante.create({
          data: {
            empresaId,
            ventaId: guardar.ventaId,
            asociadoId: guardar.asociadoId,
            tipo: datos.tipo,
            puntoVenta: c.puntoVenta,
            numero,
            fecha: new Date(`${datos.fecha}T00:00:00Z`),
            total: new Prisma.Decimal(datos.total),
            docTipo: datos.docTipo,
            docNro: datos.docNro,
            receptorNombre: guardar.receptorNombre,
            condicionIvaReceptor: datos.condicionIvaReceptor,
            cae: r.cae,
            caeVence: new Date(`${r.vence}T00:00:00Z`),
            ambiente: this.arca.ambiente,
            usuarioId: guardar.usuarioId,
          },
        });
      },
      { timeout: 60_000 },
    );
  }

  /** Factura C de una venta (una sola por venta). Sin receptor: consumidor final sin identificar. */
  async facturarVenta(empresaId: string, usuario: UsuarioContext, ventaId: string, receptor: ReceptorInput | null) {
    const c = await this.config(empresaId);
    const { venta, total } = await this.totalVenta(ventaId, empresaId);
    if (venta.deletedAt) throw new BadRequestException('La venta está anulada');
    if (!(total > 0)) throw new BadRequestException('La venta no tiene importe');
    const ya = await this.prisma.comprobante.findFirst({ where: { empresaId, ventaId, tipo: TIPO.FACTURA_C, ambiente: this.arca.ambiente } });
    if (ya) throw new ConflictException(`Esta venta ya tiene la ${NOMBRE_TIPO[ya.tipo]} ${numeroCompleto(ya.puntoVenta, ya.numero)}`);
    const r = receptor ?? { docTipo: DOC.SIN_IDENTIFICAR, docNro: '0', nombre: null, condicionIva: CONDICION_IVA.CONSUMIDOR_FINAL };
    const docNro = r.docTipo === DOC.SIN_IDENTIFICAR ? '0' : sinGuiones(r.docNro);
    if (r.docTipo === DOC.CUIT && !cuitValido(docNro)) throw new BadRequestException('El CUIT del cliente no es válido');
    if (r.docTipo === DOC.DNI && !/^\d{7,8}$/.test(docNro)) throw new BadRequestException('El DNI del cliente no es válido');
    const comp = await this.emitir(
      empresaId,
      c,
      { tipo: TIPO.FACTURA_C, fecha: fechaHoyAR(), total, concepto: 1, docTipo: r.docTipo, docNro, condicionIvaReceptor: r.condicionIva },
      { ventaId, asociadoId: null, receptorNombre: r.nombre?.trim() || venta.clienteNombre || null, usuarioId: usuario.id },
    );
    return this.resumen(comp);
  }

  /** Nota de crédito C que anula una factura completa (por ejemplo, si se anuló la venta). */
  async notaDeCredito(empresaId: string, usuario: UsuarioContext, comprobanteId: string) {
    if (usuario.rol !== 'dueno') throw new ForbiddenException('Solo el dueño puede emitir notas de crédito');
    const c = await this.config(empresaId);
    const f = await this.prisma.comprobante.findFirst({ where: { id: comprobanteId, empresaId } });
    if (!f || f.tipo !== TIPO.FACTURA_C) throw new NotFoundException('Factura no encontrada');
    if (await this.prisma.comprobante.findFirst({ where: { asociadoId: f.id } })) throw new ConflictException('Esa factura ya tiene una nota de crédito');
    const comp = await this.emitir(
      empresaId,
      c,
      {
        tipo: TIPO.NOTA_CREDITO_C,
        fecha: fechaHoyAR(),
        total: f.total.toNumber(),
        concepto: 1,
        docTipo: f.docTipo,
        docNro: f.docNro,
        condicionIvaReceptor: f.condicionIvaReceptor,
        asociado: { tipo: f.tipo, puntoVenta: f.puntoVenta, numero: f.numero, cuit: c.cuit, fecha: fecha(f.fecha)! },
      },
      { ventaId: f.ventaId, asociadoId: f.id, receptorNombre: f.receptorNombre, usuarioId: usuario.id },
    );
    return this.resumen(comp);
  }

  private resumen(
    c: { id: string; tipo: number; puntoVenta: number; numero: number; fecha: Date; total: Prisma.Decimal; cae: string; caeVence: Date; ventaId: string | null; receptorNombre: string | null; asociadoId: string | null; ambiente: string; emailEnviadoA?: string | null; emailEnviadoEn?: Date | null },
    emailCliente: string | null = null,
  ) {
    return {
      id: c.id,
      tipo: c.tipo,
      nombre: NOMBRE_TIPO[c.tipo],
      numero: numeroCompleto(c.puntoVenta, c.numero),
      fecha: fecha(c.fecha),
      total: c.total.toNumber(),
      cae: c.cae,
      caeVence: fecha(c.caeVence),
      ventaId: c.ventaId,
      receptorNombre: c.receptorNombre,
      asociadoId: c.asociadoId,
      prueba: c.ambiente !== 'produccion',
      /** Último envío por email (a quién y cuándo) y el email del cliente de la venta, para proponerlo. */
      enviadoA: c.emailEnviadoA ?? null,
      enviadoEn: c.emailEnviadoEn ?? null,
      emailCliente,
    };
  }

  async deVenta(empresaId: string, ventaId: string) {
    const [lista, venta] = await Promise.all([
      this.prisma.comprobante.findMany({ where: { empresaId, ventaId }, orderBy: { creadoEn: 'asc' } }),
      this.prisma.venta.findFirst({ where: { id: ventaId, empresaId }, select: { cliente: { select: { email: true } } } }),
    ]);
    return lista.map((c) => this.resumen(c, venta?.cliente?.email ?? null));
  }

  /**
   * Manda el comprobante en PDF por email (Resend). Sin email, usa el del cliente de la venta.
   * Queda guardado a quién y cuándo se mandó.
   */
  async enviarPorEmail(empresaId: string, comprobanteId: string, email: string | null) {
    const comp = await this.prisma.comprobante.findFirst({ where: { id: comprobanteId, empresaId }, include: { venta: { select: { cliente: { select: { email: true } } } } } });
    if (!comp) throw new NotFoundException('Comprobante no encontrado');
    const para = (email ?? comp.venta?.cliente?.email ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para)) throw new BadRequestException(email ? 'Ese email no es válido' : 'La venta no tiene un cliente con email: escribí a dónde mandarla');
    const clave = this.config_.get('RESEND_API_KEY', { infer: true });
    if (!clave) throw new ServiceUnavailableException('El envío de emails todavía no está habilitado en Analítica 360: por ahora descargá el PDF y mandalo por WhatsApp');
    const c = await this.config(empresaId);
    const { nombre, contenido } = await this.pdf(empresaId, comprobanteId);
    const datos = {
      emisor: c.razonSocial,
      comprobante: NOMBRE_TIPO[comp.tipo],
      numero: numeroCompleto(comp.puntoVenta, comp.numero),
      fecha: fecha(comp.fecha)!.split('-').reverse().join('/'),
      total: comp.total.toNumber(),
      cae: comp.cae,
      receptor: comp.receptorNombre,
      prueba: comp.ambiente !== 'produccion',
    };
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.config_.get('AVISOS_EMAIL_DESDE', { infer: true }),
        to: [para],
        subject: asuntoFactura(datos),
        html: htmlFactura(datos),
        text: textoFactura(datos),
        attachments: [{ filename: nombre, content: contenido.toString('base64') }],
      }),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    if (!r?.ok) {
      this.logger.error(`Resend respondió ${r?.status ?? 'sin respuesta'} al mandar el comprobante ${comprobanteId}`);
      throw new ServiceUnavailableException('No se pudo mandar el email. Probá de nuevo en unos minutos.');
    }
    const actualizado = await this.prisma.comprobante.update({ where: { id: comp.id }, data: { emailEnviadoA: para, emailEnviadoEn: new Date() } });
    return this.resumen(actualizado, comp.venta?.cliente?.email ?? null);
  }

  async listar(empresaId: string, desde: string, hasta: string) {
    const lista = await this.prisma.comprobante.findMany({
      where: { empresaId, fecha: { gte: new Date(`${desde}T00:00:00Z`), lte: new Date(`${hasta}T00:00:00Z`) } },
      orderBy: [{ fecha: 'desc' }, { numero: 'desc' }],
      take: 500,
    });
    return lista.map((c) => this.resumen(c));
  }

  async pdf(empresaId: string, comprobanteId: string): Promise<{ nombre: string; contenido: Buffer }> {
    const comp = await this.prisma.comprobante.findFirst({ where: { id: comprobanteId, empresaId } });
    if (!comp) throw new NotFoundException('Comprobante no encontrado');
    const c = await this.config(empresaId);
    const items = comp.ventaId ? (await this.totalVenta(comp.ventaId, empresaId)).items : [];
    const asociado = comp.asociadoId ? await this.prisma.comprobante.findUnique({ where: { id: comp.asociadoId } }) : null;
    const contenido = await pdfFactura({
      emisor: { razonSocial: c.razonSocial, cuit: c.cuit, domicilio: c.domicilio, iibb: c.iibb, inicioActividades: fecha(c.inicioActividades) },
      tipo: comp.tipo,
      puntoVenta: comp.puntoVenta,
      numero: comp.numero,
      fecha: fecha(comp.fecha)!,
      receptor: { nombre: comp.receptorNombre, docTipo: comp.docTipo, docNro: comp.docNro, condicionIva: comp.condicionIvaReceptor },
      items: comp.tipo === TIPO.FACTURA_C && items.length ? items : [{ descripcion: asociado ? `Anulación de la Factura C ${numeroCompleto(asociado.puntoVenta, asociado.numero)}` : 'Venta', cantidad: 1, precio: comp.total.toNumber() }],
      total: comp.total.toNumber(),
      cae: comp.cae,
      caeVence: fecha(comp.caeVence)!,
      asociado: asociado ? `Factura C ${numeroCompleto(asociado.puntoVenta, asociado.numero)}` : null,
      homologacion: comp.ambiente !== 'produccion',
    });
    return { nombre: `${NOMBRE_TIPO[comp.tipo].replace(/ /g, '-')}-${numeroCompleto(comp.puntoVenta, comp.numero)}.pdf`, contenido };
  }
}
