import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CrearPedidoInput,
  EstadoPedido,
  FiltrosPedidos,
  ListaPedidos,
  OrigenPedido,
  PedidoFicha,
  PedidosRepository,
  ResultadoAsignar,
  ResultadoCrearPedido,
  ResultadoDespacho,
  ResultadoItem,
  ResultadoListoDespacho,
  ResultadoTransicion,
} from './pedidos.repository.js';
import { siguienteEstadoPicking } from './pedidos.util.js';

const includeFicha = {
  items: {
    include: {
      producto: { select: { nombre: true, codigoBarra: true } },
      variante: { select: { atributos: true, sku: true } },
      lote: { select: { numeroLote: true } },
    },
  },
} satisfies Prisma.PedidoInclude;

type PedidoConFicha = Prisma.PedidoGetPayload<{ include: typeof includeFicha }>;

function etiquetaAtributos(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const partes = Object.values(raw as Record<string, unknown>)
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
  return partes.length ? partes.join('/') : null;
}

const ESTADOS_ASIGNABLES_CANCELAR: EstadoPedido[] = ['nuevo', 'en_preparacion', 'listo_despacho'];

@Injectable()
export class PrismaPedidosRepository implements PedidosRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toFicha(p: PedidoConFicha): PedidoFicha {
    const total = p.items.reduce((acc, i) => acc + i.cantidad.toNumber() * i.precioUnitario.toNumber(), 0);
    return {
      id: p.id,
      empresaId: p.empresaId,
      numeroPedido: p.numeroPedido,
      clienteId: p.clienteId,
      clienteNombre: p.clienteNombre,
      origen: p.origen as OrigenPedido,
      estado: p.estado as EstadoPedido,
      asignadoAId: p.asignadoAId,
      total,
      createdAt: p.createdAt,
      clienteEmail: p.clienteEmail,
      clienteTelefono: p.clienteTelefono,
      direccionEnvio: p.direccionEnvio,
      codigoPostal: p.codigoPostal,
      localidad: p.localidad,
      provincia: p.provincia,
      metodoEnvio: p.metodoEnvio,
      numeroSeguimiento: p.numeroSeguimiento,
      transportista: p.transportista,
      notas: p.notas,
      items: p.items.map((i) => ({
        id: i.id,
        productoId: i.productoId,
        varianteId: i.varianteId,
        loteId: i.loteId,
        productoNombre: i.producto.nombre,
        codigoBarra: i.producto.codigoBarra,
        sku: i.variante?.sku ?? null,
        varianteEtiqueta: etiquetaAtributos(i.variante?.atributos),
        numeroLote: i.lote?.numeroLote ?? null,
        cantidad: i.cantidad.toNumber(),
        precioUnitario: i.precioUnitario.toNumber(),
        cantidadPreparada: i.cantidadPreparada.toNumber(),
        preparado: i.preparado,
      })),
    };
  }

  private async resolverAsignacion(tx: Prisma.TransactionClient, empresaId: string): Promise<string | null> {
    const config = await tx.configuracionEmpresa.findUnique({ where: { empresaId } });
    if (!config || config.modoAsignacion === 'manual') return null;
    if (config.modoAsignacion === 'todo_a_uno') return config.asignacionFijaUsuarioId || null;

    const colaboradores = await tx.usuario.findMany({
      where: { empresaId, activo: true, invitacionPendiente: false, deletedAt: null },
      select: { id: true },
    });
    const activos = colaboradores.map((u) => u.id);
    const pool = config.asignacionRotacionIds.length > 0
      ? activos.filter((id) => config.asignacionRotacionIds.includes(id))
      : activos;
    if (pool.length === 0) return null;

    const desde = new Date();
    desde.setDate(desde.getDate() - 7);
    const recientes = await tx.pedido.findMany({
      where: { empresaId, asignadoAId: { in: pool }, createdAt: { gte: desde } },
      select: { asignadoAId: true },
    });
    const conteo = new Map<string, number>(pool.map((id) => [id, 0]));
    for (const p of recientes) {
      if (p.asignadoAId && conteo.has(p.asignadoAId)) conteo.set(p.asignadoAId, (conteo.get(p.asignadoAId) ?? 0) + 1);
    }
    let elegido = pool[0];
    let min = conteo.get(elegido) ?? 0;
    for (const id of pool) {
      const n = conteo.get(id) ?? 0;
      if (n < min || (n === min && id.localeCompare(elegido) < 0)) {
        min = n;
        elegido = id;
      }
    }
    return elegido;
  }

  async listar(empresaId: string, filtro: FiltrosPedidos): Promise<ListaPedidos> {
    const where: Prisma.PedidoWhereInput = {
      empresaId,
      ...(filtro.estado ? { estado: filtro.estado } : {}),
      ...(filtro.origen ? { origen: filtro.origen } : {}),
      ...(filtro.asignadoA ? { asignadoAId: filtro.asignadoA } : {}),
    };
    const from = (filtro.pagina - 1) * filtro.pageSize;
    const [filas, total] = await Promise.all([
      this.prisma.pedido.findMany({
        where,
        include: { items: { select: { cantidad: true, precioUnitario: true } } },
        orderBy: { createdAt: 'desc' },
        skip: from,
        take: filtro.pageSize,
      }),
      this.prisma.pedido.count({ where }),
    ]);
    return {
      items: filas.map((p) => ({
        id: p.id,
        empresaId: p.empresaId,
        numeroPedido: p.numeroPedido,
        clienteId: p.clienteId,
        clienteNombre: p.clienteNombre,
        origen: p.origen as OrigenPedido,
        estado: p.estado as EstadoPedido,
        asignadoAId: p.asignadoAId,
        total: p.items.reduce((acc, i) => acc + i.cantidad.toNumber() * i.precioUnitario.toNumber(), 0),
        createdAt: p.createdAt,
      })),
      total,
    };
  }

  async ficha(empresaId: string, id: string): Promise<PedidoFicha | null> {
    const pedido = await this.prisma.pedido.findFirst({ where: { id, empresaId }, include: includeFicha });
    return pedido ? this.toFicha(pedido) : null;
  }

  async crear(empresaId: string, input: CrearPedidoInput): Promise<ResultadoCrearPedido> {
    if (input.items.length === 0) return { ok: false, motivo: 'sin_items' };

    return this.prisma.$transaction(async (tx) => {
      const productoIds = [...new Set(input.items.map((i) => i.productoId))];
      const productos = await tx.producto.findMany({ where: { id: { in: productoIds }, empresaId } });
      if (productos.length !== productoIds.length) return { ok: false, motivo: 'producto_invalido' };

      const varianteIds = [...new Set(input.items.filter((i) => i.varianteId).map((i) => i.varianteId!))];
      if (varianteIds.length > 0) {
        const variantes = await tx.productoVariante.findMany({ where: { id: { in: varianteIds }, empresaId } });
        if (variantes.length !== varianteIds.length) return { ok: false, motivo: 'variante_invalida' };
        const productoDeVariante = new Map(variantes.map((v) => [v.id, v.productoId]));
        const validas = input.items.every((i) => !i.varianteId || productoDeVariante.get(i.varianteId) === i.productoId);
        if (!validas) return { ok: false, motivo: 'variante_invalida' };
      }

      if (input.clienteId) {
        const cliente = await tx.cliente.findFirst({ where: { id: input.clienteId, empresaId } });
        if (!cliente) return { ok: false, motivo: 'cliente_invalido' };
      }

      const asignadoAId = await this.resolverAsignacion(tx, empresaId);
      // A diferencia de Devolucion, Pedido SÍ tiene su tabla de numeración
      // propia (PedidoNumeracion) - se me había pasado usarla y generaba el
      // número con count()+1, vulnerable a duplicados bajo concurrencia
      // (mismo problema que ya se había resuelto para Venta/OrdenCompra).
      const numeracion = await tx.pedidoNumeracion.upsert({
        where: { empresaId },
        create: { empresaId, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      });
      const numero = numeracion.ultimo;

      const creado = await tx.pedido.create({
        data: {
          empresaId,
          numeroPedido: `PED-${numero}`,
          clienteId: input.clienteId ?? null,
          clienteNombre: input.clienteNombre,
          clienteEmail: input.clienteEmail,
          clienteTelefono: input.clienteTelefono,
          origen: 'manual',
          estado: 'nuevo',
          direccionEnvio: input.direccionEnvio,
          codigoPostal: input.codigoPostal,
          localidad: input.localidad,
          provincia: input.provincia,
          metodoEnvio: input.metodoEnvio,
          notas: input.notas,
          asignadoAId,
          items: {
            create: input.items.map((i) => ({
              productoId: i.productoId,
              varianteId: i.varianteId ?? null,
              loteId: i.loteId ?? null,
              cantidad: i.cantidad,
              precioUnitario: i.precioUnitario,
            })),
          },
        },
        include: includeFicha,
      });
      return { ok: true, pedido: this.toFicha(creado) };
    });
  }

  async asignar(empresaId: string, id: string, usuarioId: string | null): Promise<ResultadoAsignar> {
    const pedido = await this.prisma.pedido.findFirst({ where: { id, empresaId } });
    if (!pedido) return 'no_encontrado';
    if (usuarioId) {
      const usuario = await this.prisma.usuario.findFirst({ where: { id: usuarioId, empresaId } });
      if (!usuario) return 'usuario_invalido';
    }
    await this.prisma.pedido.update({ where: { id }, data: { asignadoAId: usuarioId } });
    return 'ok';
  }

  async guardarPreparacionItem(
    empresaId: string,
    id: string,
    itemId: string,
    cantidadPreparada: number,
    preparado: boolean,
  ): Promise<ResultadoItem> {
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findFirst({ where: { id, empresaId } });
      if (!pedido) return 'no_encontrado';
      const item = await tx.pedidoItem.findFirst({ where: { id: itemId, pedidoId: id } });
      if (!item) return 'no_encontrado';

      await tx.pedidoItem.update({ where: { id: itemId }, data: { cantidadPreparada, preparado } });

      const todosItems = await tx.pedidoItem.findMany({ where: { pedidoId: id } });
      const paraSync = todosItems.map((i) => ({
        cantidad: i.cantidad.toNumber(),
        cantidadPreparada: i.id === itemId ? cantidadPreparada : i.cantidadPreparada.toNumber(),
        preparado: i.id === itemId ? preparado : i.preparado,
      }));
      const nuevoEstado = siguienteEstadoPicking(pedido.estado as EstadoPedido, paraSync);
      if (nuevoEstado !== pedido.estado) {
        await tx.pedido.update({ where: { id }, data: { estado: nuevoEstado } });
      }
      return 'ok';
    });
  }

  async marcarTodoPreparado(empresaId: string, id: string): Promise<ResultadoItem> {
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findFirst({ where: { id, empresaId }, include: { items: true } });
      if (!pedido) return 'no_encontrado';

      for (const item of pedido.items) {
        await tx.pedidoItem.update({ where: { id: item.id }, data: { cantidadPreparada: item.cantidad, preparado: true } });
      }
      const nuevoEstado = siguienteEstadoPicking(
        pedido.estado as EstadoPedido,
        pedido.items.map((i) => ({ cantidad: i.cantidad.toNumber(), cantidadPreparada: i.cantidad.toNumber(), preparado: true })),
      );
      if (nuevoEstado !== pedido.estado) {
        await tx.pedido.update({ where: { id }, data: { estado: nuevoEstado } });
      }
      return 'ok';
    });
  }

  async confirmarListoDespacho(empresaId: string, id: string): Promise<ResultadoListoDespacho> {
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findFirst({ where: { id, empresaId }, include: { items: true } });
      if (!pedido) return { ok: false, motivo: 'no_encontrado' };

      const incompletos = pedido.items.some(
        (i) => !(i.cantidadPreparada.toNumber() === i.cantidad.toNumber() && i.cantidad.toNumber() > 0),
      );
      if (incompletos) return { ok: false, motivo: 'incompleto' };

      for (const item of pedido.items) {
        if (!item.preparado) await tx.pedidoItem.update({ where: { id: item.id }, data: { preparado: true } });
      }
      const actualizado = await tx.pedido.update({ where: { id }, data: { estado: 'listo_despacho' }, include: includeFicha });
      return { ok: true, pedido: this.toFicha(actualizado) };
    });
  }

  async registrarDespacho(
    empresaId: string,
    usuarioId: string,
    id: string,
    transportista: string | null,
    numeroSeguimiento: string | null,
    ubicacionOrigen: string | null,
  ): Promise<ResultadoDespacho> {
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findFirst({ where: { id, empresaId }, include: { items: true } });
      if (!pedido) return { ok: false, motivo: 'no_encontrado' };
      if (pedido.estado !== 'listo_despacho') return { ok: false, motivo: 'no_listo_despacho' };
      if (ubicacionOrigen) {
        const ubicacion = await tx.ubicacion.findFirst({ where: { empresaId, nombre: ubicacionOrigen } });
        if (!ubicacion) return { ok: false, motivo: 'ubicacion_invalida' };
      }

      const actualizado = await tx.pedido.update({
        where: { id },
        data: { estado: 'despachado', transportista, numeroSeguimiento },
        include: includeFicha,
      });

      for (const item of pedido.items) {
        await tx.movimientoInventario.create({
          data: {
            empresaId,
            productoId: item.productoId,
            varianteId: item.varianteId,
            loteId: item.loteId,
            usuarioId,
            tipo: 'pedido',
            cantidad: item.cantidad,
            signo: -1,
            precioUnitario: item.precioUnitario,
            motivo: `Pedido ${pedido.numeroPedido}`,
            referenciaId: id,
            ubicacionOrigen,
          },
        });
      }
      return { ok: true, pedido: this.toFicha(actualizado) };
    });
  }

  async marcarConTransportista(empresaId: string, id: string): Promise<ResultadoTransicion> {
    const pedido = await this.prisma.pedido.findFirst({ where: { id, empresaId } });
    if (!pedido) return 'no_encontrado';
    if (pedido.estado !== 'despachado') return 'estado_invalido';
    await this.prisma.pedido.update({ where: { id }, data: { estado: 'con_transportista' } });
    return 'ok';
  }

  async marcarEntregado(empresaId: string, id: string): Promise<ResultadoTransicion> {
    const pedido = await this.prisma.pedido.findFirst({ where: { id, empresaId } });
    if (!pedido) return 'no_encontrado';
    if (pedido.estado !== 'con_transportista') return 'estado_invalido';
    await this.prisma.pedido.update({ where: { id }, data: { estado: 'entregado' } });
    return 'ok';
  }

  async cancelar(empresaId: string, id: string): Promise<ResultadoTransicion> {
    const pedido = await this.prisma.pedido.findFirst({ where: { id, empresaId } });
    if (!pedido) return 'no_encontrado';
    if (!ESTADOS_ASIGNABLES_CANCELAR.includes(pedido.estado as EstadoPedido)) return 'estado_invalido';
    await this.prisma.pedido.update({ where: { id }, data: { estado: 'cancelado' } });
    return 'ok';
  }

  async colaboradoresActivos(empresaId: string): Promise<{ id: string; nombre: string }[]> {
    return this.prisma.usuario.findMany({
      where: { empresaId, activo: true, invitacionPendiente: false, deletedAt: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
