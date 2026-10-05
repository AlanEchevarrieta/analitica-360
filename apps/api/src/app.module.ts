import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnv } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { ProductosModule } from './modules/productos/productos.module.js';
import { VariantesModule } from './modules/productos/variantes.module.js';
import { UbicacionesModule } from './modules/ubicaciones/ubicaciones.module.js';
import { InventarioModule } from './modules/inventario/inventario.module.js';
import { ProveedoresModule } from './modules/proveedores/proveedores.module.js';
import { ComprasModule } from './modules/compras/compras.module.js';
import { VentasModule } from './modules/ventas/ventas.module.js';
import { DevolucionesModule } from './modules/devoluciones/devoluciones.module.js';
import { PedidosModule } from './modules/pedidos/pedidos.module.js';
import { InformesModule } from './modules/informes/informes.module.js';
import { ArchivosModule } from './common/archivos/archivos.module.js';
import { CuentaCorrienteModule } from './modules/cuenta-corriente/cuenta-corriente.module.js';
import { ProduccionModule } from './modules/produccion/produccion.module.js';
import { RegistroModule } from './modules/registro/registro.module.js';
import { AlianzasModule } from './modules/alianzas/alianzas.module.js';
import { ListasPreciosModule } from './modules/listas-precios/listas-precios.module.js';
import { ClientesModule } from './modules/clientes/clientes.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { ContabilidadModule } from './modules/contabilidad/contabilidad.module.js';
import { ImportExportModule } from './modules/import-export/import-export.module.js';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module.js';
import { SoporteModule } from './modules/soporte/soporte.module.js';
import { PlanesModule } from './modules/planes/planes.module.js';
import { AdminSaasModule } from './modules/admin-saas/admin-saas.module.js';
import { UsoModule } from './modules/uso/uso.module.js';
import { AuditoriaModule } from './modules/auditoria/auditoria.module.js';
import { TiendaModule } from './modules/tienda/tienda.module.js';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    UsuariosModule,
    AuthModule,
    ProductosModule,
    VariantesModule,
    UbicacionesModule,
    InventarioModule,
    ProveedoresModule,
    ComprasModule,
    VentasModule,
    DevolucionesModule,
    PedidosModule,
    ClientesModule,
    ListasPreciosModule,
    RegistroModule,
    AlianzasModule,
    ProduccionModule,
    CuentaCorrienteModule,
    ArchivosModule,
    AnalyticsModule,
    ContabilidadModule,
    ImportExportModule,
    NotificacionesModule,
    SoporteModule,
    PlanesModule,
    AdminSaasModule,
    UsoModule,
    AuditoriaModule,
    TiendaModule,
    ConfiguracionModule,
    InformesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
