import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireFuncion } from '../../common/decorators/funcion.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ArchivoService } from './archivo.service.js';
import { CATEGORIAS_ARCHIVO, ENTIDADES_ARCHIVO, MAXIMO_ARCHIVO, nombreSeguro } from './archivo.util.js';

type Archivo = { buffer: Buffer; size: number; mimetype: string; originalname: string };
// Un poco más que el máximo: así el servicio responde con el mensaje claro.
const subida = FileInterceptor('archivo', { limits: { fileSize: MAXIMO_ARCHIVO + 1024, files: 1 } });

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)');
// En el formulario (multipart) todo llega como texto: vacío = sin dato.
const vacioANull = (v: unknown) => (v === '' ? null : v);
const datosSchema = z.object({
  titulo: z.string().trim().max(160).optional(),
  categoria: z.enum(CATEGORIAS_ARCHIVO).optional(),
  entidadTipo: z.enum(ENTIDADES_ARCHIVO).optional(),
  entidadId: z.preprocess(vacioANull, z.uuid().nullable().optional()),
  vence: z.preprocess(vacioANull, fecha.nullable().optional()),
  notas: z.preprocess(vacioANull, z.string().trim().max(1000).nullable().optional()),
});
const filtroSchema = z.object({
  entidadTipo: z.enum(ENTIDADES_ARCHIVO).optional(),
  entidadId: z.uuid().optional(),
  categoria: z.enum(CATEGORIAS_ARCHIVO).optional(),
  q: z.string().trim().max(100).optional(),
});

/**
 * Archivo de documentos del negocio (plan Pro). Contratos y facturas pueden ser
 * sensibles: lo ven el dueño (los administradores cuentan como dueños) y el
 * contador; subir, editar y borrar, solo el dueño.
 */
@Controller('archivo')
@RequireFuncion('archivo')
@Roles('dueno', 'contador')
export class ArchivoController {
  constructor(private readonly archivo: ArchivoService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(filtroSchema)) filtro: z.infer<typeof filtroSchema>) {
    return this.archivo.listar(empresa.id, filtro);
  }

  @Get('uso')
  uso(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.archivo.uso(empresa.id);
  }

  @Get('por-vencer')
  porVencer(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.archivo.porVencer(empresa.id);
  }

  @Post()
  @Roles('dueno')
  @UseInterceptors(subida)
  subir(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @UploadedFile() archivo: Archivo | undefined,
    @Body(new ZodValidationPipe(datosSchema)) datos: z.infer<typeof datosSchema>,
  ) {
    return this.archivo.subir(empresa.id, usuario.id, archivo, datos);
  }

  @Get(':id/descargar')
  async descargar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    const d = await this.archivo.descargar(empresa.id, id);
    // inline para PDF y fotos (se ven en el navegador); Word y Excel se descargan.
    const inline = d.mime === 'application/pdf' || d.mime.startsWith('image/');
    return new StreamableFile(d.contenido, { type: d.mime, disposition: `${inline ? 'inline' : 'attachment'}; filename="${nombreSeguro(d.nombre).replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(d.nombre)}` });
  }

  @Patch(':id')
  @Roles('dueno')
  editar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(datosSchema)) datos: z.infer<typeof datosSchema>) {
    return this.archivo.editar(empresa.id, id, datos);
  }

  @Delete(':id')
  @Roles('dueno')
  borrar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.archivo.borrar(empresa.id, id);
  }
}
