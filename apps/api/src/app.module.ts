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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
