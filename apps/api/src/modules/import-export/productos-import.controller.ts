import { Body, Controller, Post } from '@nestjs/common';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModulo, RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ProductosImportService } from './productos-import.service.js';
import { importarProductosSchema, type ImportarProductosDto } from './productos-import.dto.js';

@Controller('import-export/productos')
@RequireModulo('productos')
export class ProductosImportController {
  constructor(private readonly productosImportService: ProductosImportService) {}

  @Post()
  @RequirePermiso('importar_datos')
  importar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @CurrentUser() usuario: UsuarioContext,
    @Body(new ZodValidationPipe(importarProductosSchema)) body: ImportarProductosDto,
  ) {
    return this.productosImportService.importar(empresa.id, usuario.id, body.filas);
  }
}
