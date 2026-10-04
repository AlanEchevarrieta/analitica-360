import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation.js';
import { AlmacenArchivosService } from '../../common/archivos/almacen-archivos.service.js';
import { optimizarImagen, TAMANOS } from '../../common/archivos/optimizar-imagen.js';
import { esViolacionUnica } from '../../common/prisma-errors.util.js';
import { PrismaService } from '../../database/prisma.service.js';
import { normalizarDominio, problemaSubdominio, sitioDesdeHost, sugerirSubdominio, tipoImagen } from './tienda-sitio.util.js';

export interface GuardarTienda {
  activa: boolean;
  subdominio: string;
  dominioPropio: string | null;
  nombre: string;
  descripcion: string | null;
  color: string;
  whatsapp: string | null;
  instagram: string | null;
  textoEnvios: string | null;
  alias: string | null;
  cbu: string | null;
  titular: string | null;
  mostrarSinStock: boolean;
  fondo: (typeof FONDOS)[number];
  tipografia: (typeof TIPOGRAFIAS)[number];
  bordes: (typeof BORDES)[number];
  anuncio: string | null;
  formaFoto: (typeof FORMAS_FOTO)[number];
  columnasCelular: number;
  seccionesOcultas: (typeof SECCIONES)[number][];
  tituloDestacados: string | null;
  sobreNosotros: string | null;
  horario: string | null;
  facebook: string | null;
  tiktok: string | null;
  pedidoMinimo: number | null;
  descuentoTransferencia: number;
}

export const FONDOS = ['puntos', 'lienzo', 'papel', 'rayas', 'ondas', 'liso'] as const;
export const TIPOGRAFIAS = ['clasica', 'elegante', 'moderna', 'amigable'] as const;
export const BORDES = ['redondeados', 'suaves', 'rectos'] as const;
export const FORMAS_FOTO = ['horizontal', 'cuadrada', 'vertical'] as const;
export const SECCIONES = ['beneficios', 'categorias', 'destacados', 'sobre'] as const;
type CampoImagen = 'logoUrl' | 'portadaUrl';

export const MAX_FOTOS = 8;
const MAX_BYTES = 15 * 1024 * 1024;

/** Campos que ve el público (nunca ids internos más allá de la empresa). */
const PUBLICO = { empresaId: true, nombre: true, descripcion: true, color: true, logoUrl: true, whatsapp: true, instagram: true, textoEnvios: true, alias: true, cbu: true, titular: true, mostrarSinStock: true, subdominio: true, dominioPropio: true, fondo: true, tipografia: true, bordes: true, portadaUrl: true, anuncio: true, formaFoto: true, columnasCelular: true, seccionesOcultas: true, tituloDestacados: true, sobreNosotros: true, horario: true, facebook: true, tiktok: true, pedidoMinimo: true, descuentoTransferencia: true } as const;

/** Los montos viajan como número (Prisma los devuelve como Decimal). */
function conMontos<T extends { pedidoMinimo: unknown; descuentoTransferencia?: unknown }>(t: T) {
  return { ...t, pedidoMinimo: t.pedidoMinimo == null ? null : Number(t.pedidoMinimo), descuentoTransferencia: Number(t.descuentoTransferencia ?? 0) };
}

@Injectable()
export class TiendaAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly almacen: AlmacenArchivosService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private base() {
    return this.config.get('TIENDA_DOMINIO_BASE', { infer: true });
  }

  /** Configuración de la tienda (o una propuesta si todavía no existe). */
  async obtener(empresaId: string) {
    const [tienda, empresa] = await Promise.all([
      this.prisma.tiendaConfig.findUnique({ where: { empresaId } }),
      this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true, telefono: true } }),
    ]);
    const base = this.base();
    if (tienda) return { existe: true, base, ...conMontos(tienda) };
    return {
      existe: false,
      base,
      activa: false,
      subdominio: await this.subdominioLibre(sugerirSubdominio(empresa?.nombre ?? 'mi-tienda')),
      dominioPropio: null,
      nombre: empresa?.nombre ?? '',
      descripcion: null,
      color: '#6366f1',
      logoUrl: null,
      whatsapp: empresa?.telefono ?? null,
      instagram: null,
      textoEnvios: null,
      alias: null,
      cbu: null,
      titular: null,
      mostrarSinStock: true,
      fondo: 'puntos',
      tipografia: 'clasica',
      bordes: 'redondeados',
      portadaUrl: null,
      anuncio: null,
      formaFoto: 'horizontal',
      columnasCelular: 1,
      seccionesOcultas: [],
      tituloDestacados: null,
      sobreNosotros: null,
      horario: null,
      facebook: null,
      tiktok: null,
      pedidoMinimo: null,
      descuentoTransferencia: 0,
    };
  }

  private async subdominioLibre(base: string) {
    const raiz = problemaSubdominio(base) ? `tienda-${base}`.slice(0, 36).replace(/-+$/, '') || 'mi-tienda' : base;
    for (let i = 0; i < 50; i++) {
      const candidato = i === 0 ? raiz : `${raiz}-${i + 1}`;
      if (!problemaSubdominio(candidato) && !(await this.prisma.tiendaConfig.findUnique({ where: { subdominio: candidato }, select: { id: true } }))) return candidato;
    }
    return `${raiz}-${Date.now().toString(36)}`;
  }

  async disponible(empresaId: string, subdominio: string) {
    const problema = problemaSubdominio(subdominio);
    if (problema) return { disponible: false, motivo: problema };
    const usado = await this.prisma.tiendaConfig.findUnique({ where: { subdominio }, select: { empresaId: true } });
    return usado && usado.empresaId !== empresaId ? { disponible: false, motivo: 'Esa dirección ya la usa otra tienda' } : { disponible: true, motivo: null };
  }

  async guardar(empresaId: string, input: GuardarTienda) {
    const problema = problemaSubdominio(input.subdominio);
    if (problema) throw new BadRequestException(problema);
    let dominioPropio: string | null = null;
    if (input.dominioPropio?.trim()) {
      dominioPropio = normalizarDominio(input.dominioPropio);
      if (!dominioPropio) throw new BadRequestException('El dominio propio no es válido (ej. minegocio.com.ar)');
      if (dominioPropio.endsWith(`.${this.base()}`) || dominioPropio === this.base()) throw new BadRequestException('Ese dominio es de la plataforma: usá el subdominio');
    }
    const datos = { ...input, dominioPropio };
    try {
      return conMontos(await this.prisma.tiendaConfig.upsert({ where: { empresaId }, create: { empresaId, ...datos }, update: datos }));
    } catch (e) {
      if (esViolacionUnica(e)) throw new ConflictException('Esa dirección o dominio ya lo usa otra tienda');
      throw e;
    }
  }

  private validarImagen(archivo: { buffer: Buffer; size: number } | undefined) {
    if (!archivo) throw new BadRequestException('No llegó ninguna imagen');
    if (archivo.size > MAX_BYTES) throw new BadRequestException('La imagen pesa más de 15 MB');
    const tipo = tipoImagen(archivo.buffer);
    if (!tipo) throw new BadRequestException('Solo imágenes JPG, PNG o WEBP');
    return tipo;
  }

  /** Logo o foto de portada: reemplaza la anterior y borra su archivo. */
  async subirImagen(empresaId: string, campo: CampoImagen, archivo: { buffer: Buffer; size: number } | undefined) {
    this.validarImagen(archivo);
    const tienda = await this.prisma.tiendaConfig.findUnique({ where: { empresaId } });
    if (!tienda) throw new BadRequestException('Primero guardá la configuración de la tienda');
    const optimizada = await this.optimizar(archivo!.buffer, campo === 'logoUrl' ? TAMANOS.logo : TAMANOS.portada, campo === 'logoUrl' ? 90 : 80);
    const { url } = await this.almacen.guardar(empresaId, optimizada, 'webp');
    await this.prisma.tiendaConfig.update({ where: { empresaId }, data: { [campo]: url } });
    await this.borrarArchivoDe(empresaId, tienda[campo]);
    return { [campo]: url };
  }

  async quitarImagen(empresaId: string, campo: CampoImagen) {
    const tienda = await this.prisma.tiendaConfig.findUnique({ where: { empresaId } });
    if (!tienda) throw new NotFoundException('La tienda todavía no existe');
    await this.prisma.tiendaConfig.update({ where: { empresaId }, data: { [campo]: null } });
    await this.borrarArchivoDe(empresaId, tienda[campo]);
    return { [campo]: null };
  }

  /** La clave es "empresa/archivo.ext" al final de la URL; solo se borra si es de esta empresa. */
  private async borrarArchivoDe(empresaId: string, url: string | null) {
    const clave = url?.split('/').slice(-2).join('/');
    if (clave?.startsWith(`${empresaId}/`)) await this.almacen.borrar(clave);
  }

  private async optimizar(buffer: Buffer, lado: number, calidad?: number) {
    try {
      return await optimizarImagen(buffer, lado, calidad);
    } catch {
      throw new BadRequestException('No se pudo leer la imagen: probá con otra foto');
    }
  }

  // ---------------------------------------------------------------- Fotos de productos

  private async producto(empresaId: string, productoId: string) {
    const p = await this.prisma.producto.findFirst({ where: { id: productoId, empresaId, deletedAt: null }, select: { id: true } });
    if (!p) throw new NotFoundException('Producto no encontrado');
  }

  async fotos(empresaId: string, productoId: string) {
    await this.producto(empresaId, productoId);
    return this.prisma.productoImagen.findMany({ where: { empresaId, productoId }, select: { id: true, url: true, urlMiniatura: true, orden: true }, orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] });
  }

  async subirFoto(empresaId: string, productoId: string, archivo: { buffer: Buffer; size: number } | undefined) {
    await this.producto(empresaId, productoId);
    this.validarImagen(archivo);
    const cantidad = await this.prisma.productoImagen.count({ where: { empresaId, productoId } });
    if (cantidad >= MAX_FOTOS) throw new BadRequestException(`Máximo ${MAX_FOTOS} fotos por producto`);
    // Grande para la ficha del producto y chica para los listados.
    const [grande, chica] = await Promise.all([this.optimizar(archivo!.buffer, TAMANOS.fotoGrande, 72), this.optimizar(archivo!.buffer, TAMANOS.fotoMiniatura, 75)]);
    const g = await this.almacen.guardar(empresaId, grande, 'webp');
    const m = await this.almacen.guardar(empresaId, chica, 'webp');
    await this.prisma.productoImagen.create({ data: { empresaId, productoId, url: g.url, clave: g.clave, urlMiniatura: m.url, claveMiniatura: m.clave, orden: cantidad } });
    return this.fotos(empresaId, productoId);
  }

  async borrarFoto(empresaId: string, productoId: string, fotoId: string) {
    const foto = await this.prisma.productoImagen.findFirst({ where: { id: fotoId, empresaId, productoId } });
    if (!foto) throw new NotFoundException('Foto no encontrada');
    await this.prisma.productoImagen.delete({ where: { id: foto.id } });
    await this.almacen.borrar(foto.clave);
    if (foto.claveMiniatura) await this.almacen.borrar(foto.claveMiniatura);
    return this.fotos(empresaId, productoId);
  }

  /** La primera de la lista queda como foto principal. */
  async ordenarFotos(empresaId: string, productoId: string, ids: string[]) {
    const actuales = await this.fotos(empresaId, productoId);
    if (ids.length !== actuales.length || !actuales.every((f) => ids.includes(f.id))) throw new BadRequestException('La lista de fotos no coincide');
    await this.prisma.$transaction(ids.map((id, orden) => this.prisma.productoImagen.update({ where: { id }, data: { orden } })));
    return this.fotos(empresaId, productoId);
  }

  // ---------------------------------------------------------------- Público

  /** Tienda activa que corresponde a un host (subdominio o dominio propio). */
  async sitio(host: string) {
    const sitio = sitioDesdeHost(host, this.base());
    if (!sitio) throw new NotFoundException('No hay una tienda en esta dirección');
    const tienda = await this.prisma.tiendaConfig.findFirst({
      where: { activa: true, ...(sitio.tipo === 'subdominio' ? { subdominio: sitio.valor } : { dominioPropio: sitio.valor }) },
      select: PUBLICO,
    });
    if (!tienda) throw new NotFoundException('No hay una tienda en esta dirección');
    return conMontos(tienda);
  }

  async configPublica(empresaId: string) {
    const tienda = await this.prisma.tiendaConfig.findFirst({ where: { empresaId, activa: true }, select: PUBLICO });
    if (!tienda) throw new NotFoundException('La tienda no está activa');
    return conMontos(tienda);
  }
}
