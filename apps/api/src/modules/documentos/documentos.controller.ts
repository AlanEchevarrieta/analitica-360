import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { DocumentosService } from './documentos.service.js';
import { TIPOS_DOCUMENTO, type TipoDocumento } from './documentos.util.js';

type Archivo = { buffer: Buffer; size: number; mimetype: string };
const subida = FileInterceptor('archivo', { limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

const configSchema = z.object({
  pie: z.string().trim().max(300).nullable().optional().transform((v) => (v === undefined ? undefined : v || null)),
  validezPresupuestoDias: z.number().int().min(1).max(365).optional(),
});
const emailSchema = z.object({ email: z.string().trim().max(160).nullable().default(null).transform((v) => v || null) });
const tipoSchema = z.enum(TIPOS_DOCUMENTO as [TipoDocumento, ...TipoDocumento[]]);
const Tipo = new ZodValidationPipe(tipoSchema);

/**
 * Documentos que no son factura: comprobante de venta, recibo y presupuesto.
 * PDF, link para WhatsApp y email. La configuración (logo, pie) la cambia el dueño.
 */
@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

  @Get('config')
  config(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.documentos.config(empresa.id);
  }

  @Patch('config')
  @Roles('dueno')
  guardarConfig(@CurrentEmpresa() empresa: EmpresaContext, @Body(new ZodValidationPipe(configSchema)) body: z.infer<typeof configSchema>) {
    return this.documentos.guardarConfig(empresa.id, body);
  }

  @Post('config/logo')
  @Roles('dueno')
  @UseInterceptors(subida)
  logo(@CurrentEmpresa() empresa: EmpresaContext, @UploadedFile() archivo: Archivo | undefined) {
    return this.documentos.subirLogo(empresa.id, archivo);
  }

  @Delete('config/logo')
  @Roles('dueno')
  quitarLogo(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.documentos.quitarLogo(empresa.id);
  }

  /** El PDF desde el link que se manda por WhatsApp: sin sesión, con un token firmado que vence. */
  @Get('ver/:token')
  @Public()
  async ver(@Param('token') token: string) {
    const d = await this.documentos.publico(String(token).slice(0, 1000));
    return new StreamableFile(d.pdf, { type: 'application/pdf', disposition: `inline; filename="${d.archivo}"` });
  }

  @Get('venta/:id/cobros')
  cobrosDeVenta(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.documentos.cobrosDeVenta(empresa.id, id);
  }

  @Get(':tipo/:id/pdf')
  async pdf(@CurrentEmpresa() empresa: EmpresaContext, @Param('tipo', Tipo) tipo: TipoDocumento, @Param('id', new ParseUUIDPipe()) id: string) {
    const d = await this.documentos.armar(empresa.id, tipo, id);
    return new StreamableFile(d.pdf, { type: 'application/pdf', disposition: `inline; filename="${d.archivo}"` });
  }

  @Post(':tipo/:id/link')
  link(@CurrentEmpresa() empresa: EmpresaContext, @Param('tipo', Tipo) tipo: TipoDocumento, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.documentos.link(empresa.id, tipo, id);
  }

  @Post(':tipo/:id/email')
  email(@CurrentEmpresa() empresa: EmpresaContext, @Param('tipo', Tipo) tipo: TipoDocumento, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(emailSchema)) body: { email: string | null }) {
    return this.documentos.email(empresa.id, tipo, id, body.email);
  }
}
