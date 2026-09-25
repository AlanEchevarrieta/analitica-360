import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { EstadosContablesService } from './estados-contables.service.js';
import {
  crearMovimientoFinancieroSchema,
  periodoEstadosSchema,
  type CrearMovimientoFinancieroDto,
  type PeriodoEstados,
} from './estados-contables.dto.js';

@Controller('estados-contables')
@RequireModulo('contabilidad')
export class EstadosContablesController {
  constructor(private readonly service: EstadosContablesService) {}

  @Get()
  estados(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(periodoEstadosSchema)) q: PeriodoEstados) {
    return this.service.estados(empresa.id, q.desde, q.hasta);
  }
}

/** Aportes, retiros, préstamos, bienes de uso, pagos a proveedores y arqueos de caja. */
@Controller('movimientos-financieros')
@RequireModulo('contabilidad')
export class MovimientosFinancierosController {
  constructor(private readonly service: EstadosContablesService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext, @Query(new ZodValidationPipe(periodoEstadosSchema)) q: PeriodoEstados) {
    return this.service.listarMovimientos(empresa.id, q.desde, q.hasta);
  }

  // Aportes, retiros y préstamos son decisiones del dueño.
  @Post()
  @Roles('dueno')
  crear(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(crearMovimientoFinancieroSchema)) body: CrearMovimientoFinancieroDto,
  ) {
    return this.service.crearMovimiento(empresa.id, usuario.id, body);
  }

  @Post(':id/anular')
  @Roles('dueno')
  @HttpCode(204)
  async anular(@CurrentEmpresa() empresa: EmpresaContext, @Param('id') id: string) {
    await this.service.anularMovimiento(empresa.id, id);
  }
}
