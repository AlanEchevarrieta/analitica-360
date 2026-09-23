import { Controller, Get } from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { ExportarDatosService } from './exportar-datos.service.js';

@Controller('import-export/exportar')
export class ExportarDatosController {
  constructor(private readonly exportarDatosService: ExportarDatosService) {}

  @Get('ventas')
  @RequireModulo('ventas')
  ventas(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.exportarDatosService.ventas(empresa.id);
  }

  @Get('productos')
  @RequireModulo('productos')
  productos(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.exportarDatosService.productos(empresa.id);
  }

  @Get('compras')
  @RequireModulo('compras')
  compras(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.exportarDatosService.compras(empresa.id);
  }

  @Get('clientes')
  @RequireModulo('clientes')
  clientes(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.exportarDatosService.clientes(empresa.id);
  }

  @Get('inventario')
  @RequireModulo('inventario')
  inventario(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.exportarDatosService.inventario(empresa.id);
  }

  @Get('gastos')
  @RequireModulo('contabilidad')
  gastos(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.exportarDatosService.gastos(empresa.id);
  }
}
