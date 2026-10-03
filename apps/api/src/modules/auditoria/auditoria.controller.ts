import { Controller, Get, Query } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { RequireAdminApp } from '../../common/decorators/admin-app.decorator.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PermitidoSinSuscripcion } from '../../common/decorators/suscripcion.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { auditoriaQuerySchema, type AuditoriaQuery } from './auditoria.dto.js';
import { AuditoriaService } from './auditoria.service.js';

/** Configuración → Auditoría: el dueño ve quién cambió qué en su empresa. */
@Controller('auditoria')
@Roles('dueno')
@PermitidoSinSuscripcion()
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(auditoriaQuerySchema)) q: AuditoriaQuery) {
    return this.auditoria.listar(empresa.id, { ...q, empresaId: undefined });
  }

  @Get('actores')
  actores(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.auditoria.actores(empresa.id);
  }
}

/** Consola → Auditoría: todas las empresas y la verificación de la cadena. */
@Controller('admin/auditoria')
@RequireAdminApp()
export class AuditoriaAdminController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  listar(@Query(new ZodValidationPipe(auditoriaQuerySchema)) q: AuditoriaQuery) {
    return this.auditoria.listar(null, q);
  }

  @Get('actores')
  actores() {
    return this.auditoria.actores(null);
  }

  @Get('verificar')
  verificar() {
    return this.auditoria.verificar();
  }
}
