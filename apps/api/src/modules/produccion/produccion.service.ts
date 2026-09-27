import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { aplicarCostoPromedio, revertirCostoPromedioEntradas } from '../inventario/costo-promedio.js';
import { normalizarAtributos } from '../productos/variantes.util.js';
import { claveInsumo, costoReceta, margenFabricacion, necesidades, type Necesidad } from './produccion.util.js';

type Tx = Prisma.TransactionClient | PrismaService;

export interface GuardarRecetaInput {
  productoId: string;
  varianteId: string | null;
  minutos: number;
  armarAlVender: boolean;
  notas: string | null;
  items: { insumoId: string; insumoVarianteId: string | null; cantidad: number }[];
}

export interface CrearOrdenInput {
  productoId: string;
  varianteId: string | null;
  cantidad: number;
  ubicacion: string | null;
  notas: string | null;
  /** Fabricar aunque el stock de insumos no alcance (el stock queda en negativo). */
  permitirFaltantes: boolean;
}

const etiqueta = (atributos: unknown) => Object.values(normalizarAtributos(atributos as Record<string, unknown>)).join(' / ');
const num = (d: { toNumber(): number } | null | undefined) => (d == null ? null : d.toNumber());
const r2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class ProduccionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Stock actual por producto+variante (clave `producto:variante`). */
  private async stock(tx: Tx, empresaId: string, productoIds: string[]): Promise<Map<string, number>> {
    if (productoIds.length === 0) return new Map();
    const filas = await tx.movimientoInventario.groupBy({
      by: ['productoId', 'varianteId', 'tipo', 'signo'],
      where: { empresaId, deletedAt: null, productoId: { in: productoIds }, tipo: { not: 'transferencia' } },
      _sum: { cantidad: true },
    });
    const mapa = new Map<string, number>();
    for (const f of filas) {
      const k = claveInsumo(f.productoId, f.varianteId);
      mapa.set(k, (mapa.get(k) ?? 0) + (f._sum.cantidad?.toNumber() ?? 0) * f.signo);
    }
    return mapa;
  }

  private async valorHora(tx: Tx, empresaId: string): Promise<number | null> {
    const c = await tx.configuracionEmpresa.findUnique({ where: { empresaId }, select: { valorHora: true } });
    return num(c?.valorHora);
  }

  /** Datos de los insumos de una receta: nombre, unidad, costo vigente (PPP). */
  private async insumos(tx: Tx, empresaId: string, items: { insumoId: string; insumoVarianteId: string | null }[]) {
    const ids = [...new Set(items.map((i) => i.insumoId))];
    const productos = await tx.producto.findMany({
      where: { empresaId, id: { in: ids } },
      select: { id: true, nombre: true, unidad: true, costo: true, deletedAt: true, variantes: { select: { id: true, atributos: true, costo: true } } },
    });
    const porId = new Map(productos.map((p) => [p.id, p]));
    return (i: { insumoId: string; insumoVarianteId: string | null }) => {
      const p = porId.get(i.insumoId);
      const v = i.insumoVarianteId ? p?.variantes.find((x) => x.id === i.insumoVarianteId) : null;
      return {
        nombre: p ? `${p.nombre}${v ? ` · ${etiqueta(v.atributos)}` : ''}` : '(producto borrado)',
        unidad: p?.unidad ?? 'unidad',
        costo: num(v?.costo) ?? num(p?.costo),
        existe: Boolean(p && !p.deletedAt && (!i.insumoVarianteId || v)),
      };
    };
  }

  // ---------------------------------------------------------------- Recetas

  async listarRecetas(empresaId: string) {
    const [recetas, valorHora] = await Promise.all([
      this.prisma.receta.findMany({
        where: { empresaId, deletedAt: null },
        include: { items: true, producto: { select: { nombre: true, precioVenta: true, variantes: { select: { id: true, atributos: true, precioVenta: true } } } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.valorHora(this.prisma, empresaId),
    ]);
    const datos = await this.insumos(this.prisma, empresaId, recetas.flatMap((r) => r.items));
    return recetas
      .map((r) => {
        const v = r.varianteId ? r.producto.variantes.find((x) => x.id === r.varianteId) : null;
        const precio = num(v?.precioVenta) ?? num(r.producto.precioVenta);
        const costo = costoReceta(
          r.items.map((i) => ({ insumoId: i.insumoId, insumoVarianteId: i.insumoVarianteId, cantidad: i.cantidad.toNumber(), costoUnitario: datos(i).costo })),
          r.minutos.toNumber(),
          valorHora,
        );
        return {
          id: r.id,
          productoId: r.productoId,
          varianteId: r.varianteId,
          nombre: `${r.producto.nombre}${v ? ` · ${etiqueta(v.atributos)}` : ''}`,
          armarAlVender: r.armarAlVender,
          componentes: r.items.length,
          precio,
          costo,
          margen: margenFabricacion(precio, costo.total),
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  async obtenerReceta(empresaId: string, productoId: string, varianteId: string | null) {
    const producto = await this.prisma.producto.findFirst({
      where: { id: productoId, empresaId, deletedAt: null },
      select: { id: true, nombre: true, precioVenta: true, costo: true, unidad: true, variantes: { where: { deletedAt: null }, select: { id: true, atributos: true, precioVenta: true } } },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    const receta = await this.prisma.receta.findFirst({ where: { empresaId, productoId, varianteId, deletedAt: null }, include: { items: true } });
    const [valorHora, stock] = await Promise.all([this.valorHora(this.prisma, empresaId), this.stock(this.prisma, empresaId, receta?.items.map((i) => i.insumoId) ?? [])]);
    const datos = await this.insumos(this.prisma, empresaId, receta?.items ?? []);
    const items = (receta?.items ?? []).map((i) => {
      const d = datos(i);
      return { insumoId: i.insumoId, insumoVarianteId: i.insumoVarianteId, cantidad: i.cantidad.toNumber(), nombre: d.nombre, unidad: d.unidad, costoUnitario: d.costo, stock: stock.get(claveInsumo(i.insumoId, i.insumoVarianteId)) ?? 0, existe: d.existe };
    });
    const v = varianteId ? producto.variantes.find((x) => x.id === varianteId) : null;
    const precio = num(v?.precioVenta) ?? num(producto.precioVenta);
    const costo = costoReceta(items, receta?.minutos.toNumber() ?? 0, valorHora);
    return {
      producto: { id: producto.id, nombre: producto.nombre, precio, variantes: producto.variantes.map((x) => ({ id: x.id, etiqueta: etiqueta(x.atributos) })) },
      receta: receta ? { id: receta.id, minutos: receta.minutos.toNumber(), armarAlVender: receta.armarAlVender, notas: receta.notas } : null,
      items,
      valorHora,
      costo,
      margen: margenFabricacion(precio, costo.total),
    };
  }

  async guardarReceta(empresaId: string, input: GuardarRecetaInput) {
    const producto = await this.prisma.producto.findFirst({ where: { id: input.productoId, empresaId, deletedAt: null }, select: { id: true, variantes: { select: { id: true } } } });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    if (input.varianteId && !producto.variantes.some((v) => v.id === input.varianteId)) throw new BadRequestException('Esa variante no es de este producto');
    if (input.items.some((i) => i.insumoId === input.productoId)) throw new BadRequestException('Un producto no puede llevarse a sí mismo en la receta');

    const insumoIds = [...new Set(input.items.map((i) => i.insumoId))];
    const insumos = await this.prisma.producto.findMany({ where: { empresaId, id: { in: insumoIds }, deletedAt: null }, select: { id: true, nombre: true, usaVariantes: true, variantes: { where: { deletedAt: null }, select: { id: true } } } });
    if (insumos.length !== insumoIds.length) throw new BadRequestException('Hay un componente que no existe en tu empresa');
    for (const i of input.items) {
      const insumo = insumos.find((p) => p.id === i.insumoId)!;
      if (!i.insumoVarianteId && insumo.usaVariantes && insumo.variantes.length > 0) {
        throw new BadRequestException(`Elegí qué variante de "${insumo.nombre}" lleva la receta`);
      }
      if (i.insumoVarianteId && !insumos.find((p) => p.id === i.insumoId)?.variantes.some((v) => v.id === i.insumoVarianteId)) {
        throw new BadRequestException('Hay una variante de componente que no corresponde');
      }
    }
    if (input.armarAlVender) {
      // Un kit que se arma al vender no puede tener otro kit "al vender" adentro (se complicaría el stock).
      const anidados = await this.prisma.receta.count({ where: { empresaId, deletedAt: null, armarAlVender: true, productoId: { in: insumoIds } } });
      if (anidados > 0) throw new BadRequestException('Un kit que se arma al vender no puede incluir otro kit que también se arma al vender');
    }

    return this.prisma.$transaction(async (tx) => {
      const actual = await tx.receta.findFirst({ where: { empresaId, productoId: input.productoId, varianteId: input.varianteId, deletedAt: null } });
      const datos = { minutos: input.minutos, armarAlVender: input.armarAlVender, notas: input.notas };
      const receta = actual
        ? await tx.receta.update({ where: { id: actual.id }, data: datos })
        : await tx.receta.create({ data: { empresaId, productoId: input.productoId, varianteId: input.varianteId, ...datos } });
      await tx.recetaItem.deleteMany({ where: { recetaId: receta.id } });
      await tx.recetaItem.createMany({ data: input.items.map((i) => ({ recetaId: receta.id, insumoId: i.insumoId, insumoVarianteId: i.insumoVarianteId, cantidad: i.cantidad })) });
      return { id: receta.id };
    });
  }

  async eliminarReceta(empresaId: string, id: string) {
    const { count } = await this.prisma.receta.updateMany({ where: { id, empresaId, deletedAt: null }, data: { deletedAt: new Date() } });
    if (count === 0) throw new NotFoundException('Receta no encontrada');
  }

  // ---------------------------------------------------------------- Órdenes

  private async recetaParaProducir(tx: Tx, empresaId: string, productoId: string, varianteId: string | null) {
    const receta =
      (await tx.receta.findFirst({ where: { empresaId, productoId, varianteId, deletedAt: null }, include: { items: true } })) ??
      (varianteId ? await tx.receta.findFirst({ where: { empresaId, productoId, varianteId: null, deletedAt: null }, include: { items: true } }) : null);
    if (!receta || receta.items.length === 0) throw new BadRequestException('Ese producto todavía no tiene receta: cargala primero');
    if (receta.armarAlVender) throw new BadRequestException('Este kit se arma al vender: no hace falta fabricarlo por adelantado');
    return receta;
  }

  /** Qué hace falta para fabricar `cantidad` y cuánto va a costar (sin guardar nada). */
  async previsualizar(empresaId: string, productoId: string, varianteId: string | null, cantidad: number) {
    const receta = await this.recetaParaProducir(this.prisma, empresaId, productoId, varianteId);
    return this.calcularOrden(this.prisma, empresaId, receta, cantidad);
  }

  private async calcularOrden(tx: Tx, empresaId: string, receta: { minutos: Prisma.Decimal; items: { insumoId: string; insumoVarianteId: string | null; cantidad: Prisma.Decimal }[] }, cantidad: number) {
    const componentes = receta.items.map((i) => ({ insumoId: i.insumoId, insumoVarianteId: i.insumoVarianteId, cantidad: i.cantidad.toNumber() }));
    const [stock, valorHora, datos] = await Promise.all([
      this.stock(tx, empresaId, componentes.map((c) => c.insumoId)),
      this.valorHora(tx, empresaId),
      this.insumos(tx, empresaId, componentes),
    ]);
    const lineas = necesidades(componentes, cantidad, stock).map((n: Necesidad) => {
      const d = datos(n);
      return { ...n, nombre: d.nombre, unidad: d.unidad, costoUnitario: d.costo ?? 0, costo: r2(n.necesita * (d.costo ?? 0)) };
    });
    const costoMateriales = r2(lineas.reduce((a, l) => a + l.costo, 0));
    const costoManoObra = valorHora ? r2((receta.minutos.toNumber() / 60) * valorHora * cantidad) : 0;
    return { lineas, costoMateriales, costoManoObra, costoUnitario: r2(costoMateriales / cantidad), faltan: lineas.filter((l) => l.falta > 0).length };
  }

  async crearOrden(empresaId: string, usuarioId: string, input: CrearOrdenInput) {
    if (input.ubicacion && !(await this.prisma.ubicacion.findFirst({ where: { empresaId, nombre: input.ubicacion }, select: { id: true } }))) {
      throw new BadRequestException('Esa ubicación no existe en tu empresa');
    }
    return this.prisma.$transaction(async (tx) => {
      const receta = await this.recetaParaProducir(tx, empresaId, input.productoId, input.varianteId);
      const calculo = await this.calcularOrden(tx, empresaId, receta, input.cantidad);
      if (calculo.faltan > 0 && !input.permitirFaltantes) {
        throw new ConflictException({ message: 'No alcanzan los insumos para fabricar esa cantidad', codigo: 'faltan_insumos', lineas: calculo.lineas });
      }
      const ultimo = await tx.ordenProduccion.aggregate({ where: { empresaId }, _max: { numero: true } });
      const fecha = new Date();
      const orden = await tx.ordenProduccion.create({
        data: {
          empresaId,
          numero: (ultimo._max.numero ?? 0) + 1,
          recetaId: receta.id,
          productoId: input.productoId,
          varianteId: input.varianteId,
          cantidad: input.cantidad,
          costoMateriales: calculo.costoMateriales,
          costoManoObra: calculo.costoManoObra,
          ubicacion: input.ubicacion,
          notas: input.notas,
          usuarioId,
          fecha,
        },
      });
      // El costo del producto terminado se promedia con el stock que ya había (PPP), antes de sumar la entrada.
      if (calculo.costoUnitario > 0) {
        await aplicarCostoPromedio(tx, empresaId, [{ productoId: input.productoId, varianteId: input.varianteId, cantidad: input.cantidad, costoUnitario: calculo.costoUnitario }], fecha);
      }
      const motivo = `Orden de producción #${orden.numero}`;
      for (const l of calculo.lineas) {
        await tx.movimientoInventario.create({
          data: { empresaId, productoId: l.insumoId, varianteId: l.insumoVarianteId, usuarioId, tipo: 'consumo_produccion', cantidad: l.necesita, signo: -1, costoUnitario: l.costoUnitario, motivo, ubicacionOrigen: input.ubicacion, referenciaId: orden.id, fecha },
        });
      }
      await tx.movimientoInventario.create({
        data: { empresaId, productoId: input.productoId, varianteId: input.varianteId, usuarioId, tipo: 'produccion', cantidad: input.cantidad, signo: 1, costoUnitario: calculo.costoUnitario, motivo, ubicacionDestino: input.ubicacion, referenciaId: orden.id, fecha },
      });
      return { id: orden.id, numero: orden.numero, ...calculo };
    });
  }

  /** Deshace una orden: vuelven los insumos y sale lo fabricado (si todavía está en stock). */
  async anularOrden(empresaId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const orden = await tx.ordenProduccion.findFirst({ where: { id, empresaId } });
      if (!orden) throw new NotFoundException('Orden no encontrada');
      if (orden.estado === 'anulada') throw new BadRequestException('Esa orden ya estaba anulada');
      const stock = await this.stock(tx, empresaId, [orden.productoId]);
      const disponible = stock.get(claveInsumo(orden.productoId, orden.varianteId)) ?? 0;
      if (disponible < orden.cantidad.toNumber()) {
        throw new ConflictException(`No se puede anular: de lo fabricado quedan ${disponible} en stock (ya se vendió o usó una parte).`);
      }
      const costoUnitario = orden.costoMateriales.toNumber() / orden.cantidad.toNumber();
      if (costoUnitario > 0) {
        await revertirCostoPromedioEntradas(tx, empresaId, [{ productoId: orden.productoId, varianteId: orden.varianteId, cantidad: orden.cantidad.toNumber(), costoUnitario }]);
      }
      await tx.movimientoInventario.updateMany({ where: { empresaId, referenciaId: orden.id, tipo: { in: ['produccion', 'consumo_produccion'] }, deletedAt: null }, data: { deletedAt: new Date() } });
      await tx.ordenProduccion.update({ where: { id: orden.id }, data: { estado: 'anulada', anuladaAt: new Date() } });
      return { ok: true };
    });
  }

  async listarOrdenes(empresaId: string) {
    const ordenes = await this.prisma.ordenProduccion.findMany({
      where: { empresaId },
      orderBy: { numero: 'desc' },
      take: 200,
      include: { producto: { select: { nombre: true, variantes: { select: { id: true, atributos: true } } } } },
    });
    const usuarios = await this.prisma.usuario.findMany({ where: { id: { in: [...new Set(ordenes.map((o) => o.usuarioId))] } }, select: { id: true, nombre: true } });
    const nombre = new Map(usuarios.map((u) => [u.id, u.nombre]));
    return ordenes.map((o) => {
      const v = o.varianteId ? o.producto.variantes.find((x) => x.id === o.varianteId) : null;
      return {
        id: o.id,
        numero: o.numero,
        fecha: o.fecha,
        producto: `${o.producto.nombre}${v ? ` · ${etiqueta(v.atributos)}` : ''}`,
        productoId: o.productoId,
        cantidad: o.cantidad.toNumber(),
        costoMateriales: o.costoMateriales.toNumber(),
        costoManoObra: o.costoManoObra.toNumber(),
        costoUnitario: r2(o.costoMateriales.toNumber() / o.cantidad.toNumber()),
        estado: o.estado,
        usuario: nombre.get(o.usuarioId) ?? null,
        notas: o.notas,
      };
    });
  }
}
