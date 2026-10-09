import { Module } from '@nestjs/common';
import { AlianzasModule } from '../alianzas/alianzas.module.js';
import { MercadoPagoCliente } from './mercadopago.cliente.js';
import { MercadoPagoController, MercadoPagoWebhookController } from './mercadopago.controller.js';
import { MercadoPagoService } from './mercadopago.service.js';

@Module({
  imports: [AlianzasModule],
  controllers: [MercadoPagoController, MercadoPagoWebhookController],
  providers: [MercadoPagoCliente, MercadoPagoService],
})
export class MercadoPagoModule {}
