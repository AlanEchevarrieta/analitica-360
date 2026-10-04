import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { EmpresaContext } from '../../common/auth/request-context.types.js';
import { CurrentEmpresa } from '../../common/decorators/current-empresa.decorator.js';
import { RequirePermiso } from '../../common/decorators/permiso.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PrismaService } from '../../database/prisma.service.js';
import { hoyAR, normalizarCodigo, precioConOferta } from './precios-tienda.util.js';

// Ofertas por producto y cupones de la tienda online: los carga el dueño desde la app.
// Todo pasa por Prisma, así queda en la bitácora de auditoría.

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .nullable()
  .optional()
  .transform((v) => v || null);
const desdeAntesQueHasta = (d: { desde: string | null; hasta: string | null }) => !d.desde || !d.hasta || d.desde <= d.hasta;

export const ofertaSchema = z
  .object({
    tipo: z.enum(['porcentaje', 'precio']),
    valor: z.number().positive('Poné un valor mayor a 0').max(1_000_000_000),
    desde: fecha,
    hasta: fecha,
  })
  .refine((o) => o.tipo !== 'porcentaje' || o.valor < 100, { message: 'El porcentaje tiene que ser menor a 100', path: ['valor'] })
  .refine(desdeAntesQueHasta, { message: 'La fecha de fin es anterior a la de inicio', path: ['hasta'] });
export type OfertaInput = z.infer<typeof ofertaSchema>;

const cuponBase = z.object({
  codigo: z
    .string()
    .transform(normalizarCodigo)
    .pipe(z.string().regex(/^[A-Z0-9_-]{3,40}$/, 'El código lleva de 3 a 40 letras, números, - o _')),
  tipo: z.enum(['porcentaje', 'monto']),
  valor: z.number().positive('Poné un valor mayor a 0').max(1_000_000_000),
  compraMinima: z.number().min(0).max(1_000_000_000).nullable().optional().transform((v) => v || null),
  desde: fecha,
  hasta: fecha,
  usosMax: z.number().int().min(1).max(1_000_000).nullable().optional().transform((v) => v ?? null),
  activo: z.boolean().default(true),
});
export const cuponSchema = cuponBase
  .refine((c) => c.tipo !== 'porcentaje' || c.valor < 100, { message: 'El porcentaje tiene que ser menor a 100', path: ['valor'] })
  .refine(desdeAntesQueHasta, { message: 'La fecha de fin es anterior a la de inicio', path: ['hasta'] });
export type CuponInput = z.infer<typeof cuponSchema>;
const cuponEdicionSchema = cuponBase.omit({ codigo: true }).partial();

const aFecha = (s: string | null | undefined) => (s ? new Date(`${s}T00:00:00Z`) : s === null ? null : undefined);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

@Injectable()
export class DescuentosTiendaService {
  constructor(private readonly prisma: PrismaService) {}

  async ponerOferta(empresaId: string, productoId: string, o: OfertaInput) {
    const p = await this.prisma.producto.findFirst({ where: { id: productoId, empresaId, deletedAt: null }, select: { precioVenta: true, usaVariantes: true } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    if (o.tipo === 'precio') {
      if (p.usaVariantes) throw new BadRequestException('En un producto con variantes usá un porcentaje: cada variante tiene su precio');
      if (!p.precioVenta || o.valor >= p.precioVenta.toNumber()) throw new BadRequestException('El precio de oferta tiene que ser menor que el precio de venta');
    }
    await this.prisma.producto.update({
      where: { id: productoId },
      data: { ofertaTipo: o.tipo, ofertaValor: o.valor, ofertaDesde: aFecha(o.desde), ofertaHasta: aFecha(o.hasta) },
    });
    return this.oferta(empresaId, productoId);
  }

  async quitarOferta(empresaId: string, productoId: string) {
    const { count } = await this.prisma.producto.updateMany({
      where: { id: productoId, empresaId },
      data: { ofertaTipo: null, ofertaValor: null, ofertaDesde: null, ofertaHasta: null },
    });
    if (!count) throw new NotFoundException('Producto no encontrado');
    return { oferta: null };
  }

  async oferta(empresaId: string, productoId: string) {
    const p = await this.prisma.producto.findFirst({ where: { id: productoId, empresaId }, select: { precioVenta: true, ofertaTipo: true, ofertaValor: true, ofertaDesde: true, ofertaHasta: true } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    if (!p.ofertaTipo || p.ofertaValor == null) return { oferta: null };
    const oferta = { tipo: p.ofertaTipo as 'porcentaje' | 'precio', valor: p.ofertaValor.toNumber(), desde: iso(p.ofertaDesde), hasta: iso(p.ofertaHasta) };
    const hoy = hoyAR();
    // Cómo se ve hoy en la tienda (puede estar programada o vencida).
    const final = precioConOferta(p.precioVenta?.toNumber() ?? 0, oferta, hoy);
    const estado = oferta.desde && hoy < oferta.desde ? 'programada' : oferta.hasta && hoy > oferta.hasta ? 'vencida' : 'vigente';
    return { oferta: { ...oferta, estado, precioFinal: final.precio, descuentoPct: final.descuentoPct } };
  }

  async listarCupones(empresaId: string) {
    const lista = await this.prisma.cuponTienda.findMany({ where: { empresaId }, orderBy: [{ activo: 'desc' }, { createdAt: 'desc' }] });
    const [hoy, usosPorCodigo] = [hoyAR(), await this.usos(empresaId)];
    return lista.map((c) => ({
      id: c.id,
      codigo: c.codigo,
      tipo: c.tipo,
      valor: c.valor.toNumber(),
      compraMinima: c.compraMinima?.toNumber() ?? null,
      desde: iso(c.desde),
      hasta: iso(c.hasta),
      usosMax: c.usosMax,
      usos: c.usos,
      activo: c.activo,
      estado: !c.activo ? 'inactivo' : c.hasta && iso(c.hasta)! < hoy ? 'vencido' : c.desde && hoy < iso(c.desde)! ? 'programado' : c.usosMax != null && c.usos >= c.usosMax ? 'agotado' : 'vigente',
      // Cuánto descontó en pedidos (para saber si convino).
      descontado: usosPorCodigo.get(c.codigo) ?? 0,
    }));
  }

  private async usos(empresaId: string) {
    const filas = await this.prisma.pedido.groupBy({ by: ['cuponCodigo'], where: { empresaId, cuponCodigo: { not: null }, estado: { not: 'cancelado' } }, _sum: { descuentoCupon: true } });
    return new Map(filas.map((f) => [f.cuponCodigo!, f._sum.descuentoCupon?.toNumber() ?? 0]));
  }

  async crearCupon(empresaId: string, c: CuponInput) {
    try {
      await this.prisma.cuponTienda.create({
        data: { empresaId, codigo: c.codigo, tipo: c.tipo, valor: c.valor, compraMinima: c.compraMinima, desde: aFecha(c.desde), hasta: aFecha(c.hasta), usosMax: c.usosMax, activo: c.activo },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException(`Ya existe el código ${c.codigo}`);
      throw e;
    }
    return this.listarCupones(empresaId);
  }

  async editarCupon(empresaId: string, id: string, c: z.infer<typeof cuponEdicionSchema>) {
    const actual = await this.prisma.cuponTienda.findFirst({ where: { id, empresaId } });
    if (!actual) throw new NotFoundException('Cupón no encontrado');
    const tipo = c.tipo ?? actual.tipo;
    const valor = c.valor ?? actual.valor.toNumber();
    if (tipo === 'porcentaje' && valor >= 100) throw new BadRequestException('El porcentaje tiene que ser menor a 100');
    if (c.usosMax != null && c.usosMax < actual.usos) throw new BadRequestException(`Ya se usó ${actual.usos} veces: el límite no puede ser menor`);
    await this.prisma.cuponTienda.update({
      where: { id },
      data: { ...c, desde: aFecha(c.desde), hasta: aFecha(c.hasta) },
    });
    return this.listarCupones(empresaId);
  }
}

/** Oferta de un producto en la tienda online (quien puede editar productos). */
@Controller('productos/:productoId/oferta')
@RequirePermiso('editar_productos')
export class OfertasController {
  constructor(private readonly service: DescuentosTiendaService) {}

  @Get()
  obtener(@CurrentEmpresa() empresa: EmpresaContext, @Param('productoId', new ParseUUIDPipe()) id: string) {
    return this.service.oferta(empresa.id, id);
  }

  @Put()
  poner(@CurrentEmpresa() empresa: EmpresaContext, @Param('productoId', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(ofertaSchema)) body: OfertaInput) {
    return this.service.ponerOferta(empresa.id, id, body);
  }

  @Delete()
  quitar(@CurrentEmpresa() empresa: EmpresaContext, @Param('productoId', new ParseUUIDPipe()) id: string) {
    return this.service.quitarOferta(empresa.id, id);
  }
}

/** Cupones de la tienda online (los ve el equipo; los crea y cambia el dueño). */
@Controller('tienda-config/cupones')
export class CuponesTiendaController {
  constructor(private readonly service: DescuentosTiendaService) {}

  @Get()
  listar(@CurrentEmpresa() empresa: EmpresaContext) {
    return this.service.listarCupones(empresa.id);
  }

  @Post()
  @Roles('dueno')
  crear(@CurrentEmpresa() empresa: EmpresaContext, @Body(new ZodValidationPipe(cuponSchema)) body: CuponInput) {
    return this.service.crearCupon(empresa.id, body);
  }

  @Patch(':id')
  @Roles('dueno')
  editar(@CurrentEmpresa() empresa: EmpresaContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(cuponEdicionSchema)) body: z.infer<typeof cuponEdicionSchema>) {
    return this.service.editarCupon(empresa.id, id, body);
  }
}
