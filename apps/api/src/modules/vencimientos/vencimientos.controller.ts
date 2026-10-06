import { Controller, Get } from '@nestjs/common';
import { RequireAdminApp } from '../../common/decorators/admin-app.decorator.js';
import { VencimientosService } from './vencimientos.service.js';

/** Consola: datos que vencen (dólar, topes del monotributo) con su semáforo. */
@Controller('admin/vencimientos')
@RequireAdminApp()
export class VencimientosController {
  constructor(private readonly vencimientos: VencimientosService) {}

  @Get()
  estado() {
    return this.vencimientos.estado();
  }
}
