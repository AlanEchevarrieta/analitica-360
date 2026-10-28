import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequireModulo } from '../../common/decorators/permiso.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import type { ConfigurarPasarelaDto, CrearCobroRapidoDto } from './dto/configurar-pasarela.dto.js';
import { PasarelasCoordinadorService } from './pasarelas-coordinador.service.js';
import type {
  EstadoTransaccion,
  OrigenCobroTipo,
  ProveedorPasarela,
} from './pasarelas.types.js';

@Controller('pasarelas')
@RequireModulo('ventas')
export class PasarelasController {
  constructor(private readonly coordinador: PasarelasCoordinadorService) {}

  @Get('config')
  obtenerConfiguracion(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.coordinador.obtenerConfiguracion(empresa.id);
  }

  @Post('config')
  guardarConfiguracion(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Body() dto: ConfigurarPasarelaDto,
  ) {
    return this.coordinador.guardarConfiguracion(empresa.id, dto);
  }

  @Delete('config/:proveedor')
  desconectar(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Param('proveedor') proveedor: ProveedorPasarela,
  ) {
    return this.coordinador.desconectar(empresa.id, proveedor);
  }

  @Post('cobros')
  crearCobro(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Body() dto: CrearCobroRapidoDto,
  ) {
    return this.coordinador.crearCobro(empresa.id, dto);
  }

  @Get('transacciones')
  listarTransacciones(
    @CurrentEmpresa() empresa: EmpresaContext,
    @Query('proveedor') proveedor?: ProveedorPasarela,
    @Query('estado') estado?: EstadoTransaccion,
    @Query('origenTipo') origenTipo?: OrigenCobroTipo,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.coordinador.listarTransacciones(empresa.id, {
      proveedor,
      estado,
      origenTipo,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('metricas')
  obtenerMetricas(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.coordinador.obtenerMetricas(empresa.id);
  }
}

/** Controlador público para recepción de webhooks de Mercado Pago, Ualá Bis y Stripe. */
@Controller('pasarelas/webhook')
@Public()
export class PasarelasWebhookController {
  constructor(private readonly coordinador: PasarelasCoordinadorService) {}

  @Post(':proveedor')
  @HttpCode(200)
  async recibirWebhook(
    @Param('proveedor') proveedor: ProveedorPasarela,
    @Body() payload: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    return this.coordinador.procesarWebhook({
      proveedor,
      payload,
      headers,
      query,
    });
  }

  @Post(':negocio/:proveedor')
  @HttpCode(200)
  async recibirWebhookNegocio(
    @Param('negocio') negocio: string,
    @Param('proveedor') proveedor: ProveedorPasarela,
    @Body() payload: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    return this.coordinador.procesarWebhook({
      negocio,
      proveedor,
      payload,
      headers,
      query,
    });
  }
}

/** Controlador simplificado directo /webhook/:negocio y /webhook/:negocio/:proveedor */
@Controller('webhook')
@Public()
export class WebhookDinamicoController {
  constructor(private readonly coordinador: PasarelasCoordinadorService) {}

  @Post(':negocio/:proveedor')
  @HttpCode(200)
  async recibirWebhook(
    @Param('negocio') negocio: string,
    @Param('proveedor') proveedor: ProveedorPasarela,
    @Body() payload: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    return this.coordinador.procesarWebhook({
      negocio,
      proveedor,
      payload,
      headers,
      query,
    });
  }

  @Post(':negocio')
  @HttpCode(200)
  async recibirWebhookPorDefecto(
    @Param('negocio') negocio: string,
    @Body() payload: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, string | string[] | undefined>,
  ) {
    // Si viene x-signature asumimos mercadopago, o si viene stripe-signature asumimos stripe
    const proveedor: ProveedorPasarela =
      headers['stripe-signature'] ? 'stripe' : 'mercadopago';

    return this.coordinador.procesarWebhook({
      negocio,
      proveedor,
      payload,
      headers,
      query,
    });
  }
}
