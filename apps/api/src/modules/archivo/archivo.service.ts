import { BadRequestException, Injectable, Logger, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ArchivoDocumento } from '@prisma/client';
import { AlmacenArchivosService } from '../../common/archivos/almacen-archivos.service.js';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import {
  avisoQueToca,
  diasEntre,
  ESPACIO_POR_EMPRESA,
  estadoVencimiento,
  MAXIMO_ARCHIVO,
  nombreSeguro,
  tipoDeArchivo,
  type CategoriaArchivo,
  type EntidadArchivo,
} from './archivo.util.js';

export interface DatosArchivo {
  titulo?: string;
  categoria?: CategoriaArchivo;
  entidadTipo?: EntidadArchivo;
  entidadId?: string | null;
  vence?: string | null;
  notas?: string | null;
}

const NOMBRE_CATEGORIA: Record<string, string> = {
  factura_proveedor: 'Factura de proveedor',
  contrato: 'Contrato',
  habilitacion: 'Habilitación',
  seguro: 'Seguro',
  constancia: 'Constancia',
  otro: 'Documento',
};
const fecha = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
const dmy = (f: string) => f.split('-').reverse().join('/');

/**
 * Archivo de documentos del negocio (plan Pro): PDF, fotos, Word y Excel pegados a
 * la empresa, un proveedor, un cliente o una compra, con vencimiento opcional.
 * Los archivos van a la carpeta privada: solo se bajan con sesión.
 */
@Injectable()
export class ArchivoService {
  private readonly logger = new Logger('Archivo');

  constructor(
    private readonly prisma: PrismaService,
    private readonly almacen: AlmacenArchivosService,
    private readonly env: ConfigService<Env, true>,
  ) {}

  private vista(a: ArchivoDocumento, hoy = fechaHoyAR()) {
    const vence = fecha(a.vence);
    return {
      id: a.id,
      titulo: a.titulo,
      categoria: a.categoria,
      entidadTipo: a.entidadTipo,
      entidadId: a.entidadId,
      nombre: a.nombre,
      mime: a.mime,
      tamano: a.tamano,
      vence,
      estado: estadoVencimiento(vence, hoy),
      diasParaVencer: vence ? diasEntre(hoy, vence) : null,
      notas: a.notas,
      createdAt: a.createdAt.toISOString(),
    };
  }

  /** "Proveedor: Calabazas del Norte", "Compra del 12/09/2026"… para la lista general. */
  private async conNombres<T extends { entidadTipo: string; entidadId: string | null }>(empresaId: string, filas: T[]): Promise<(T & { entidadNombre: string | null })[]> {
    const ids = (tipo: string) => [...new Set(filas.filter((f) => f.entidadTipo === tipo && f.entidadId).map((f) => f.entidadId!))];
    const [proveedores, clientes, compras] = await Promise.all([
      ids('proveedor').length ? this.prisma.proveedor.findMany({ where: { empresaId, id: { in: ids('proveedor') } }, select: { id: true, nombre: true } }) : [],
      ids('cliente').length ? this.prisma.cliente.findMany({ where: { empresaId, id: { in: ids('cliente') } }, select: { id: true, nombre: true } }) : [],
      ids('compra').length ? this.prisma.compra.findMany({ where: { empresaId, id: { in: ids('compra') } }, select: { id: true, fecha: true, proveedorNombre: true } }) : [],
    ]);
    const nombre = (f: T): string | null => {
      if (f.entidadTipo === 'proveedor') return proveedores.find((p) => p.id === f.entidadId)?.nombre ?? null;
      if (f.entidadTipo === 'cliente') return clientes.find((c) => c.id === f.entidadId)?.nombre ?? null;
      if (f.entidadTipo === 'compra') {
        const c = compras.find((x) => x.id === f.entidadId);
        return c ? `Compra del ${dmy(fecha(c.fecha)!)}${c.proveedorNombre ? ` (${c.proveedorNombre})` : ''}` : null;
      }
      return null;
    };
    return filas.map((f) => ({ ...f, entidadNombre: nombre(f) }));
  }

  /** El proveedor, cliente o compra tiene que ser de esta empresa. */
  private async validarEntidad(empresaId: string, tipo: EntidadArchivo, id: string | null | undefined) {
    if (tipo === 'empresa') return null;
    if (!id) throw new BadRequestException('Falta indicar a qué se adjunta el documento');
    const existe =
      tipo === 'proveedor'
        ? await this.prisma.proveedor.count({ where: { id, empresaId } })
        : tipo === 'cliente'
          ? await this.prisma.cliente.count({ where: { id, empresaId } })
          : await this.prisma.compra.count({ where: { id, empresaId } });
    if (!existe) throw new BadRequestException('No encontramos a qué adjuntar el documento');
    return id;
  }

  async uso(empresaId: string) {
    const r = await this.prisma.archivoDocumento.aggregate({ where: { empresaId, deletedAt: null }, _sum: { tamano: true }, _count: true });
    return { usado: r._sum.tamano ?? 0, limite: ESPACIO_POR_EMPRESA, cantidad: r._count };
  }

  async listar(empresaId: string, filtro: { entidadTipo?: EntidadArchivo; entidadId?: string; categoria?: string; q?: string }) {
    const filas = await this.prisma.archivoDocumento.findMany({
      where: {
        empresaId,
        deletedAt: null,
        ...(filtro.entidadTipo ? { entidadTipo: filtro.entidadTipo } : {}),
        ...(filtro.entidadId ? { entidadId: filtro.entidadId } : {}),
        ...(filtro.categoria ? { categoria: filtro.categoria } : {}),
        ...(filtro.q ? { OR: [{ titulo: { contains: filtro.q, mode: 'insensitive' as const } }, { nombre: { contains: filtro.q, mode: 'insensitive' as const } }, { notas: { contains: filtro.q, mode: 'insensitive' as const } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const hoy = fechaHoyAR();
    return this.conNombres(empresaId, filas.map((f) => this.vista(f, hoy)));
  }

  async subir(empresaId: string, usuarioId: string, archivo: { buffer: Buffer; size: number; originalname?: string } | undefined, datos: DatosArchivo) {
    if (!archivo?.buffer?.length) throw new BadRequestException('Elegí un archivo');
    if (archivo.size > MAXIMO_ARCHIVO) throw new PayloadTooLargeException('El archivo pesa más de 20 MB');
    // Multer entrega el nombre en latin1: se pasa a UTF-8 para no romper las tildes.
    const original = Buffer.from(archivo.originalname ?? 'documento', 'latin1').toString('utf8');
    const tipo = tipoDeArchivo(archivo.buffer, original);
    if (!tipo) throw new BadRequestException('Ese tipo de archivo no se acepta: subí un PDF, una foto (JPG, PNG o WEBP), un Word o un Excel');
    const { usado } = await this.uso(empresaId);
    if (usado + archivo.size > ESPACIO_POR_EMPRESA) throw new PayloadTooLargeException('Llegaste al espacio del archivo (10 GB): borrá documentos que ya no necesites');
    const entidadTipo = datos.entidadTipo ?? 'empresa';
    const entidadId = await this.validarEntidad(empresaId, entidadTipo, datos.entidadId);
    if (datos.vence && !/^\d{4}-\d{2}-\d{2}$/.test(datos.vence)) throw new BadRequestException('Fecha de vencimiento inválida');
    const clave = await this.almacen.guardarPrivado(empresaId, archivo.buffer, tipo.extension);
    const titulo = datos.titulo?.trim() || original.replace(/\.[^.]+$/, '').slice(0, 160) || 'Documento';
    const creado = await this.prisma.archivoDocumento.create({
      data: {
        empresaId, usuarioId, titulo, categoria: datos.categoria ?? 'otro', entidadTipo, entidadId,
        nombre: nombreSeguro(original), mime: tipo.mime, tamano: archivo.size, clave,
        vence: datos.vence ? new Date(`${datos.vence}T00:00:00Z`) : null, notas: datos.notas?.trim() || null,
      },
    });
    return this.vista(creado);
  }

  private async buscar(empresaId: string, id: string) {
    const a = await this.prisma.archivoDocumento.findFirst({ where: { id, empresaId, deletedAt: null } });
    if (!a) throw new NotFoundException('Documento no encontrado');
    return a;
  }

  async descargar(empresaId: string, id: string) {
    const a = await this.buscar(empresaId, id);
    const contenido = await this.almacen.leerPrivado(empresaId, a.clave);
    if (!contenido) throw new NotFoundException('No encontramos el archivo. Escribinos a soporte.');
    return { contenido, nombre: a.nombre, mime: a.mime };
  }

  async editar(empresaId: string, id: string, datos: DatosArchivo) {
    const a = await this.buscar(empresaId, id);
    const entidadTipo = datos.entidadTipo ?? (a.entidadTipo as EntidadArchivo);
    const entidadId = datos.entidadTipo !== undefined || datos.entidadId !== undefined ? await this.validarEntidad(empresaId, entidadTipo, datos.entidadId ?? a.entidadId) : a.entidadId;
    const nuevoVence = datos.vence === undefined ? fecha(a.vence) : datos.vence;
    const actualizado = await this.prisma.archivoDocumento.update({
      where: { id },
      data: {
        titulo: datos.titulo?.trim() || undefined,
        categoria: datos.categoria,
        entidadTipo,
        entidadId,
        notas: datos.notas === undefined ? undefined : datos.notas?.trim() || null,
        vence: nuevoVence ? new Date(`${nuevoVence}T00:00:00Z`) : null,
        // Si cambia el vencimiento (se renovó), los avisos vuelven a salir.
        ...(nuevoVence !== fecha(a.vence) ? { avisado30: null, avisado7: null } : {}),
      },
    });
    return this.vista(actualizado);
  }

  async borrar(empresaId: string, id: string) {
    const a = await this.buscar(empresaId, id);
    await this.prisma.archivoDocumento.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.almacen.borrarPrivado(empresaId, a.clave);
    return { ok: true };
  }

  /** Para Inicio: lo vencido y lo que vence en los próximos 30 días. */
  async porVencer(empresaId: string) {
    const hoy = fechaHoyAR();
    const hasta = new Date(Date.parse(`${hoy}T00:00:00Z`) + 30 * 86_400_000);
    const filas = await this.prisma.archivoDocumento.findMany({ where: { empresaId, deletedAt: null, vence: { lte: hasta } }, orderBy: { vence: 'asc' }, take: 20 });
    return this.conNombres(empresaId, filas.map((f) => this.vista(f, hoy)));
  }

  /**
   * Avisos por email a los dueños y administradores: a los 30 días y a los 7.
   * Uno por empresa con todo lo que toca. Sin Resend no hace nada (sale en Inicio igual).
   */
  async avisarVencimientos(): Promise<number> {
    const clave = this.env.get('RESEND_API_KEY', { infer: true });
    if (!clave) return 0;
    const hoy = fechaHoyAR();
    const hasta = new Date(Date.parse(`${hoy}T00:00:00Z`) + 30 * 86_400_000);
    const candidatos = await this.prisma.archivoDocumento.findMany({
      where: { deletedAt: null, vence: { gte: new Date(`${hoy}T00:00:00Z`), lte: hasta }, OR: [{ avisado30: null }, { avisado7: null }] },
      orderBy: { vence: 'asc' },
    });
    const porEmpresa = new Map<string, { doc: ArchivoDocumento; aviso: '30' | '7' }[]>();
    for (const d of candidatos) {
      const aviso = avisoQueToca(fecha(d.vence), hoy, Boolean(d.avisado30), Boolean(d.avisado7));
      if (aviso) porEmpresa.set(d.empresaId, [...(porEmpresa.get(d.empresaId) ?? []), { doc: d, aviso }]);
    }
    let enviados = 0;
    const urlApp = this.env.get('APP_URL_PUBLICA', { infer: true }).replace(/\/$/, '');
    for (const [empresaId, docs] of porEmpresa) {
      const [empresa, usuarios] = await Promise.all([
        this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true, deletedAt: true } }),
        this.prisma.usuario.findMany({ where: { empresaId, rolCrudo: { in: ['dueno', 'administrador'] }, activo: true, deletedAt: null }, select: { email: true } }),
      ]);
      if (!empresa || empresa.deletedAt) continue;
      const para = [...new Set(usuarios.map((u) => u.email.trim().toLowerCase()).filter((e) => e.includes('@')))];
      if (para.length === 0) continue;
      const lineas = docs.map(({ doc }) => {
        const faltan = diasEntre(hoy, fecha(doc.vence)!);
        return `• ${NOMBRE_CATEGORIA[doc.categoria] ?? 'Documento'}: ${doc.titulo} — vence el ${dmy(fecha(doc.vence)!)} (${faltan === 0 ? 'hoy' : faltan === 1 ? 'mañana' : `en ${faltan} días`})`;
      });
      const texto = [`Hola, ${empresa.nombre}:`, '', 'Estos documentos están por vencer:', ...lineas, '', `Cuando los renueves, subí el nuevo y cambiá la fecha en Documentos: ${urlApp}/documentos`, '', 'Analítica 360'].join('\n');
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: this.env.get('AVISOS_EMAIL_DESDE', { infer: true }), to: para, subject: `${docs.length === 1 ? 'Un documento vence' : `${docs.length} documentos vencen`} pronto · ${empresa.nombre}`, text: texto }),
        });
        if (!r.ok) {
          this.logger.warn(`Resend respondió ${r.status} al avisar vencimientos de ${empresaId}`);
          continue;
        }
      } catch (e) {
        this.logger.warn(`No se pudo avisar vencimientos de ${empresaId}: ${String(e)}`);
        continue;
      }
      const ahora = new Date();
      for (const { doc, aviso } of docs) {
        // El de 7 días también cubre el de 30 (no tiene sentido mandarlo después).
        await this.prisma.archivoDocumento.update({ where: { id: doc.id }, data: aviso === '7' ? { avisado7: ahora, avisado30: doc.avisado30 ?? ahora } : { avisado30: ahora } });
      }
      enviados++;
    }
    return enviados;
  }
}
