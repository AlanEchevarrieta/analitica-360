import { Module } from '@nestjs/common';
import { MercadoPagoAdapter } from './adapters/mercadopago.adapter.js';
import { StripeAdapter } from './adapters/stripe.adapter.js';
import { UalaAdapter } from './adapters/uala.adapter.js';
import { PasarelasCoordinadorService } from './pasarelas-coordinador.service.js';
import {
  PasarelasController,
  PasarelasWebhookController,
  WebhookDinamicoController,
} from './pasarelas.controller.js';

@Module({
  controllers: [
    PasarelasController,
    PasarelasWebhookController,
    WebhookDinamicoController,
  ],
  providers: [
    MercadoPagoAdapter,
    UalaAdapter,
    StripeAdapter,
    PasarelasCoordinadorService,
  ],
  exports: [PasarelasCoordinadorService],
})
export class PasarelasModule {}
