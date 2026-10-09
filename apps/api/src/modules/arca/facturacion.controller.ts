import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, StreamableFile } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { FacturacionService } from './facturacion.service.js';

const fecha = z.iso.date();
const configSchema = z.object({
  cuit: z.string().trim().min(11).max(13),
  razonSocial: z.string().trim().min(2).max(120),
  domicilio: z.string().trim().min(3).max(200),
  inicioActividades: fecha.nullable().default(null),
  iibb: z.string().trim().max(30).nullable().default(null),
  puntoVenta: z.number().int().min(1).max(99999),
});
const receptorSchema = z
  .object({
    docTipo: z.union([z.literal(80), z.literal(96), z.literal(99)]),
    docNro: z.string().trim().max(13).default('0'),
    nombre: z.string().trim().max(120).nullable().default(null),
    condicionIva: z.union([z.literal(1), z.literal(4), z.literal(5), z.literal(6)]).default(5),
  })
  .nullable()
  .default(null);
const facturarSchema = z.object({ receptor: receptorSchema });
const listarSchema = z.object({ desde: fecha, hasta: fecha });

/** Factura electrónica (ARCA): configuración, Factura C de una venta, nota de crédito y PDF. */
@Controller('facturacion')
@RequireModulo('ventas')
export class FacturacionController {
  constructor(private readonly servicio: FacturacionService) {}

  @Get()
  estado(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.servicio.estado(empresa.id);
  }

  @Put('config')
  guardarConfig(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Body(new ZodValidationPipe(configSchema)) body: z.infer<typeof configSchema>) {
    return this.servicio.guardarConfig(empresa.id, usuario, body);
  }

  @Post('verificar')
  verificar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext) {
    return this.servicio.verificar(empresa.id, usuario);
  }

  @Get('comprobantes')
  listar(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(listarSchema)) q: z.infer<typeof listarSchema>) {
    return this.servicio.listar(empresa.id, q.desde, q.hasta);
  }

  @Get('ventas/:ventaId')
  deVenta(@CurrentEmpresa() empresa: EmpresaContext, @Param('ventaId', new ParseUUIDPipe()) ventaId: string) {
    return this.servicio.deVenta(empresa.id, ventaId);
  }

  @Post('ventas/:ventaId')
  @RequirePermiso('registrar_ventas')
  facturar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('ventaId', new ParseUUIDPipe()) ventaId: string,
    @Body(new ZodValidationPipe(facturarSchema)) body: z.infer<typeof facturarSchema>,
  ) {
    return this.servicio.facturarVenta(empresa.id, usuario, ventaId, body.receptor);
  }

  @Post('comprobantes/:id/nota-credito')
  notaCredito(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.servicio.notaDeCredito(empresa.id, usuario, id);
  }

  @Get('comprobantes/:id/pdf')
  async pdf(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    const { nombre, contenido } = await this.servicio.pdf(empresa.id, id);
    return new StreamableFile(contenido, { type: 'application/pdf', disposition: `inline; filename="${nombre}"` });
  }
}
