import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Put, StreamableFile } from '@nestjs/common';
import { z } from 'zod';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { EnviosService, type ConfigEnviosInput } from './envios.service.js';

const credencial = z.string().trim().max(200).nullable().default(null).transform((v) => v || null);
const configSchema = z.object({
  cuentaId: z.number().int().positive(),
  origenId: z.number().int().positive().nullable().default(null),
  token: credencial,
  secreto: credencial,
  enTienda: z.boolean().default(true),
  gratisDesde: z.number().min(0).max(1_000_000_000).nullable().default(null),
  pesoDefectoGr: z.number().int().min(10).max(100_000).default(1000),
});

/** Configuración → Envíos (conectar la cuenta de Zipnova). */
@Controller('envios')
@RequireModulo('pedidos')
export class EnviosController {
  constructor(private readonly envios: EnviosService) {}

  @Get()
  estado(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.envios.estado(empresa.id);
  }

  @Put()
  guardar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Body(new ZodValidationPipe(configSchema)) body: ConfigEnviosInput) {
    return this.envios.guardar(empresa.id, usuario, body);
  }

  @Delete()
  @HttpCode(204)
  async desconectar(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext) {
    await this.envios.desconectar(empresa.id, usuario);
  }
}

/** El envío de cada pedido: crearlo, la etiqueta y el estado. */
@Controller('pedidos/:id/envio')
@RequireModulo('pedidos')
export class PedidoEnvioController {
  constructor(private readonly envios: EnviosService) {}

  @Post()
  @RequirePermiso('hacer_picking')
  crear(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.envios.crearEnvio(empresa.id, id, usuario.id);
  }

  @Get('etiqueta')
  async etiqueta(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    const { pdf, nombre } = await this.envios.etiqueta(empresa.id, id);
    return new StreamableFile(pdf, { type: 'application/pdf', disposition: `inline; filename="${nombre}"` });
  }

  @Post('actualizar')
  @HttpCode(200)
  actualizar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.envios.actualizar(empresa.id, id);
  }
}

/** Avisos de cambio de estado de Zipnova (sin sesión: los identifica la clave de la URL). */
@Controller('webhooks/zipnova')
@Public()
export class AvisosZipnovaController {
  constructor(private readonly envios: EnviosService) {}

  @Post(':clave')
  @HttpCode(200)
  async aviso(@Param('clave') clave: string, @Body() cuerpo: unknown) {
    if (!/^[\w-]{20,64}$/.test(clave) || !(await this.envios.aviso(clave, cuerpo))) throw new NotFoundException();
    return { ok: true };
  }
}
