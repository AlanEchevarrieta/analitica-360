import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { BORDES, FONDOS, FORMAS_FOTO, SECCIONES, TIPOGRAFIAS, TiendaAdminService } from './tienda-admin.service.js';
import { TiendaThrottlerGuard } from './tienda-throttler.guard.js';
import { RequireFuncion } from '../../common/decorators/funcion.decorator.js';

type Archivo = { buffer: Buffer; size: number; mimetype: string };
/** Las imágenes se reciben en memoria (máx. 15 MB: fotos directas del celular), se validan por contenido y se guardan optimizadas. */
const subida = FileInterceptor('archivo', { limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

const texto = (max: number) => z.string().trim().max(max).nullable().transform((v) => v || null).default(null);
const tiendaSchema = z.object({
  activa: z.boolean(),
  subdominio: z.string().trim().toLowerCase(),
  dominioPropio: texto(120),
  nombre: z.string().trim().min(1, 'Poné el nombre de la tienda').max(80),
  descripcion: texto(300),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido'),
  whatsapp: texto(30),
  instagram: texto(60),
  textoEnvios: texto(500),
  alias: texto(60),
  cbu: z.string().trim().regex(/^(\d{22})?$/, 'El CBU/CVU tiene 22 números').nullable().transform((v) => v || null).default(null),
  titular: texto(80),
  mostrarSinStock: z.boolean().default(true),
  fondo: z.enum(FONDOS).default('puntos'),
  tipografia: z.enum(TIPOGRAFIAS).default('clasica'),
  bordes: z.enum(BORDES).default('redondeados'),
  anuncio: texto(120),
  formaFoto: z.enum(FORMAS_FOTO).default('horizontal'),
  columnasCelular: z.number().int().min(1).max(2).default(1),
  seccionesOcultas: z.array(z.enum(SECCIONES)).max(SECCIONES.length).default([]),
  tituloDestacados: texto(60),
  sobreNosotros: texto(1500),
  horario: texto(120),
  facebook: texto(100),
  tiktok: texto(60),
  pedidoMinimo: z.number().min(0).max(100_000_000).nullable().transform((v) => v || null).default(null),
  /** % por pagar con transferencia (0 = sin descuento). */
  descuentoTransferencia: z.number().min(0).max(50, 'Hasta 50%').default(0),
});

/** Configuración de la tienda online (la cambia el dueño). */
@Controller('tienda-config')
@RequireFuncion('tienda')
export class TiendaConfigController {
  constructor(private readonly service: TiendaAdminService) {}

  @Get()
  obtener(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.service.obtener(empresa.id);
  }

  @Get('disponible')
  disponible(@CurrentEmpresa() empresa: EmpresaContext, @Query('subdominio') subdominio = '') {
    return this.service.disponible(empresa.id, subdominio.trim().toLowerCase());
  }

  @Put()
  @Roles('dueno')
  guardar(@CurrentEmpresa() empresa: EmpresaContext, @Body(new ZodValidationPipe(tiendaSchema)) body: z.infer<typeof tiendaSchema>) {
    return this.service.guardar(empresa.id, body);
  }

  @Post('logo')
  @Roles('dueno')
  @UseInterceptors(subida)
  logo(@CurrentEmpresa() empresa: EmpresaContext, @UploadedFile() archivo: Archivo | undefined) {
    return this.service.subirImagen(empresa.id, 'logoUrl', archivo);
  }

  @Delete('logo')
  @Roles('dueno')
  quitarLogo(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.service.quitarImagen(empresa.id, 'logoUrl');
  }

  @Post('portada')
  @Roles('dueno')
  @UseInterceptors(subida)
  portada(@CurrentEmpresa() empresa: EmpresaContext, @UploadedFile() archivo: Archivo | undefined) {
    return this.service.subirImagen(empresa.id, 'portadaUrl', archivo);
  }

  @Delete('portada')
  @Roles('dueno')
  quitarPortada(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.service.quitarImagen(empresa.id, 'portadaUrl');
  }
}

/** Fotos de un producto (tienda online y fichas). */
@Controller('productos/:productoId/fotos')
@RequireModulo('productos')
export class ProductoFotosController {
  constructor(private readonly service: TiendaAdminService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext, @Param('productoId', ParseUUIDPipe) productoId: string) {
    return this.service.fotos(empresa.id, productoId);
  }

  @Post()
  @RequirePermiso('editar_productos')
  @UseInterceptors(subida)
  subir(@CurrentEmpresa() empresa: EmpresaContext, @Param('productoId', ParseUUIDPipe) productoId: string, @UploadedFile() archivo: Archivo | undefined) {
    return this.service.subirFoto(empresa.id, productoId, archivo);
  }

  @Put('orden')
  @RequirePermiso('editar_productos')
  ordenar(@CurrentEmpresa() empresa: EmpresaContext, @Param('productoId', ParseUUIDPipe) productoId: string, @Body(new ZodValidationPipe(z.object({ ids: z.array(z.uuid()) }))) body: { ids: string[] }) {
    return this.service.ordenarFotos(empresa.id, productoId, body.ids);
  }

  @Delete(':fotoId')
  @RequirePermiso('editar_productos')
  borrar(@CurrentEmpresa() empresa: EmpresaContext, @Param('productoId', ParseUUIDPipe) productoId: string, @Param('fotoId', ParseUUIDPipe) fotoId: string) {
    return this.service.borrarFoto(empresa.id, productoId, fotoId);
  }
}

/** Público: qué tienda corresponde a una dirección, y su configuración. */
@Controller('tienda-sitio')
@Public()
@UseGuards(TiendaThrottlerGuard)
export class TiendaSitioController {
  constructor(private readonly service: TiendaAdminService) {}

  @Get()
  sitio(@Query('host') host = '') {
    return this.service.sitio(host);
  }

  /**
   * Para el proxy con HTTPS (Caddy, on_demand_tls → ask): solo pide certificado para
   * direcciones que son de una tienda activa (si no, cualquiera podría hacerle pedir miles).
   */
  @Get('tls')
  async tls(@Query('domain') domain = '') {
    await this.service.sitio(String(domain).slice(0, 253));
    return { ok: true };
  }

  @Get(':empresaId')
  config(@Param('empresaId', ParseUUIDPipe) empresaId: string) {
    return this.service.configPublica(empresaId);
  }
}
