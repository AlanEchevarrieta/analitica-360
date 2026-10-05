import { Module } from '@nestjs/common';
import { PlanesModule } from '../planes/planes.module.js';
import { AlianzasAdminController } from './alianzas-admin.controller.js';
import { AlianzasAdminService } from './alianzas-admin.service.js';
import { AlianzasController } from './alianzas.controller.js';
import { CobrosService } from './cobros.service.js';
import { CuponesService } from './cupones.service.js';
import { AdminReferidosController, ReferidosController } from './referidos.controller.js';
import { ReferidosService } from './referidos.service.js';

/**
 * Alianzas con cámaras y cupones: códigos, prueba gratis extendida,
 * descuentos, comisiones y liquidaciones. Registro y la consola de pagos
 * (AdminSaas) usan CuponesService y CobrosService.
 */
@Module({
  // AccesoCuentaService: tras un pago o una prueba extendida, el acceso rige al instante.
  imports: [PlanesModule],
  controllers: [AlianzasController, AlianzasAdminController, ReferidosController, AdminReferidosController],
  providers: [CuponesService, CobrosService, AlianzasAdminService, ReferidosService],
  exports: [CuponesService, CobrosService],
})
export class AlianzasModule {}
