import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { EmpresaContext, UsuarioContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { SinEmpresa } from '../../common/decorators/sin-empresa.decorator.js';
import { PermitidoSinSuscripcion } from '../../common/decorators/suscripcion.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CobrosService } from './cobros.service.js';
import { CuponesService } from './cupones.service.js';
import { codigoQuerySchema, codigoSchema } from './alianzas.dto.js';
import { beneficiosDelCupon, type ReglasCupon } from './alianzas.util.js';

/** Lo que ve el emprendedor: su código y los precios. Nada de comisiones. */
@Controller()
export class AlianzasController {
  constructor(
    private readonly cupones: CuponesService,
    private readonly cobros: CobrosService,
    private readonly prisma: PrismaService,
  ) {}

  /** Registro (/bienvenida): valida el código mientras lo escribe. El control final es al registrarse. */
  @Get('registro/codigo')
  @SinEmpresa()
  async verificarEnRegistro(@Req() request: Request, @Query(new ZodValidationPipe(codigoQuerySchema)) q: { codigo: string }) {
    if (!q.codigo) return { ok: false, mensaje: 'Escribí el código' };
    const v = await this.cupones.verificar(q.codigo, { clerkUserId: request.clerkAuth!.clerkUserId });
    if (!v.ok) return v;
    const generales = await this.cobros.cuotasGenerales(this.prisma, 'pro');
    return {
      ok: true,
      codigo: v.cupon.codigo,
      camara: v.cupon.camaraNombre,
      diasPrueba: v.diasPrueba,
      mesGratis: v.mesGratis,
      aviso: v.aviso,
      beneficios: beneficiosDelCupon(v.cupon, v.mesGratis, generales),
    };
  }

  /** Precios para la pantalla de Planes: con el código de la empresa o, si no tiene, el que está probando. */
  @Get('suscripcion/precios')
  @PermitidoSinSuscripcion()
  async precios(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Query(new ZodValidationPipe(codigoQuerySchema)) q: { codigo: string }) {
    const [actual, cuotasEnCurso, generales] = await Promise.all([
      this.prisma.empresa.findUnique({ where: { id: empresa.id }, include: { cupon: { include: { camara: { select: { nombre: true } } } } } }),
      this.cobros.cuotasEnCurso(empresa.id),
      this.cobros.cuotasGenerales(this.prisma, 'pro'),
    ]);
    const base = { cuotasEnCurso };
    if (actual?.cupon) {
      const reglas = actual.cupon.reglas as ReglasCupon;
      // La prueba del cupón ya la tuvo (o no le correspondía): los beneficios que quedan son los de pago.
      const conPrueba = Boolean(actual.pruebaHasta && actual.cupon.diasPrueba && new Date() < actual.pruebaHasta);
      return {
        ...base,
        cupon: { codigo: actual.cupon.codigo, camara: actual.cupon.camara?.nombre ?? null, aplicado: true, diasPrueba: actual.cupon.diasPrueba },
        beneficios: beneficiosDelCupon({ diasPrueba: actual.cupon.diasPrueba, reglas }, conPrueba, generales),
        aviso: null,
        planes: await this.cobros.tablaDePrecios(empresa.id, reglas),
      };
    }
    if (q.codigo) {
      const v = await this.cupones.verificar(q.codigo, { email: usuario.email, clerkUserId: usuario.clerkUserId, empresaId: empresa.id, cuit: actual?.cuit }, empresa.id);
      if (!v.ok) return { ...base, cupon: null, beneficios: null, aviso: v.mensaje, planes: await this.cobros.tablaDePrecios(empresa.id, null) };
      // Ya registrado: la prueba del cupón solo extiende una prueba que siga vigente (no se promete si ya paga).
      const sub = await this.prisma.suscripcion.findFirst({ where: { empresaId: empresa.id }, orderBy: [{ fechaVencimiento: { sort: 'desc', nulls: 'last' } }] });
      const enPrueba = sub?.estado === 'periodo_prueba' && sub.fechaVencimiento != null && sub.fechaVencimiento > new Date();
      const mesGratis = v.mesGratis && enPrueba;
      return {
        ...base,
        cupon: { codigo: v.cupon.codigo, camara: v.cupon.camaraNombre, aplicado: false, diasPrueba: mesGratis ? v.diasPrueba : null },
        beneficios: beneficiosDelCupon(v.cupon, mesGratis, generales),
        aviso: v.aviso,
        planes: await this.cobros.tablaDePrecios(empresa.id, v.cupon.reglas),
      };
    }
    return { ...base, cupon: null, beneficios: null, aviso: null, planes: await this.cobros.tablaDePrecios(empresa.id, null) };
  }

  /** Cargar un código después del registro (solo el dueño). */
  @Post('suscripcion/codigo')
  @HttpCode(200)
  @Roles('dueno')
  @PermitidoSinSuscripcion()
  aplicarCodigo(@CurrentEmpresa() empresa: EmpresaContext, @CurrentUser() usuario: UsuarioContext, @Body(new ZodValidationPipe(codigoSchema)) body: { codigo: string }) {
    return this.cupones.aplicarDespues(empresa.id, { email: usuario.email, clerkUserId: usuario.clerkUserId }, body.codigo);
  }
}
