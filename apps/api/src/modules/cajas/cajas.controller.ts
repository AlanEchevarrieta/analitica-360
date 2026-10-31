import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  abrirCajaSchema,
  cerrarCajaSchema,
  crearMovimientoCajaSchema,
  listarCajasQuerySchema,
  type AbrirCajaInput,
  type CerrarCajaInput,
  type CrearMovimientoCajaInput,
  type ListarCajasQuery,
} from './cajas.dto.js';
import { CajasService } from './cajas.service.js';

@Controller('cajas')
@RequireModulo('ventas')
export class CajasController {
  constructor(private readonly cajasService: CajasService) {}

  /** Obtiene el turno de caja abierto actual de la empresa con métricas en tiempo real. */
  @Get('activa')
  obtenerActiva(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.cajasService.obtenerActiva(empresa.id);
  }

  /** Abre un nuevo turno de caja con fondo inicial. */
  @Post('abrir')
  abrir(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(abrirCajaSchema)) dto: AbrirCajaInput,
  ) {
    return this.cajasService.abrir(empresa.id, usuario.id, dto);
  }

  /** Registra un movimiento (sangría / egreso o ingreso extraordinario). */
  @Post(':id/movimientos')
  crearMovimiento(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(crearMovimientoCajaSchema)) dto: CrearMovimientoCajaInput,
  ) {
    return this.cajasService.crearMovimiento(empresa.id, usuario.id, id, dto);
  }

  /** Emite el Reporte X (corte parcial en cualquier momento sin cerrar turno). */
  @Get(':id/reporte-x')
  reporteX(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.cajasService.reporteX(empresa.id, id);
  }

  /**
   * Arqueo Ciego y Cierre de Caja (Reporte Z definitivo).
   * El cajero declara el efectivo físico contado sin ver el saldo teórico.
   */
  @Post(':id/cerrar')
  cerrar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(cerrarCajaSchema)) dto: CerrarCajaInput,
  ) {
    return this.cajasService.cerrar(empresa.id, usuario.id, id, dto);
  }

  /** Obtiene el Reporte Z de un turno cerrado. */
  @Get(':id/reporte-z')
  reporteZ(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.cajasService.reporteZ(empresa.id, id);
  }

  /** Historial de turnos de caja pasados. */
  @Get()
  listar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query(new ZodValidationPipe(listarCajasQuerySchema)) query: ListarCajasQuery,
  ) {
    return this.cajasService.listar(empresa.id, query);
  }
}
