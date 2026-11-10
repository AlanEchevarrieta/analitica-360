import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { UsuarioContext } from '../../common/auth/request-context.types.js';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { PlantillasProyectoService } from './plantillas-proyecto.service.js';
import {
  codigoProyecto,
  estadoAtraso,
  fechasObjetivo,
  metricasEtapas,
  puedeAprobarInternamente,
  puedeOperarEtapa,
  transicionEtapa,
  type EstadoEtapa,
  type EstadoProyecto,
  type FaltaAprobacion,
  type TipoAprobacion,
} from './proyectos.util.js';

export interface EtapaCrearInput {
  nombre: string;
  aprobacion?: TipoAprobacion;
  diasObjetivo?: number | null;
  fechaObjetivo?: string | null;
  responsableId?: string | null;
  aprobadorInternoId?: string | null;
}

export interface CrearProyectoInput {
  nombre: string;
  clienteId?: string | null;
  clienteNombre?: string | null;
  descripcion?: string | null;
  plantillaId?: string | null;
  etapas?: EtapaCrearInput[];
  responsableId?: string | null;
  miembros?: string[];
  fechaInicio: string;
  fechaComprometida?: string | null;
  montoAcordado?: number | null;
  presupuestoId?: string | null;
}

export interface FiltrosProyecto {
  estado?: string;
  responsableId?: string;
  clienteId?: string;
  atrasados?: string;
}

const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

@Injectable()
export class ProyectosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plantillas: PlantillasProyectoService,
  ) {}

  async responsables(empresaId: string) {
    const usuarios = await this.prisma.usuario.findMany({
      where: { empresaId, activo: true, deletedAt: null },
      orderBy: [{ nombre: 'asc' }, { email: 'asc' }],
      select: { id: true, nombre: true, email: true, rolCrudo: true },
    });
    return usuarios.map((u) => ({
      id: u.id,
      nombre: u.nombre || u.email,
      email: u.email,
      rol: u.rolCrudo,
    }));
  }

  private async mapaUsuarios(empresaId: string): Promise<Map<string, string>> {
    const filas = await this.prisma.usuario.findMany({
      where: { empresaId },
      select: { id: true, nombre: true, email: true },
    });
    return new Map(filas.map((u) => [u.id, u.nombre || u.email]));
  }

  private async mapaClientesTelefono(empresaId: string, ids: string[]): Promise<Map<string, string | null>> {
    if (ids.length === 0) return new Map();
    const filas = await this.prisma.cliente.findMany({
      where: { empresaId, id: { in: ids } },
      select: { id: true, telefono: true },
    });
    return new Map(filas.map((c) => [c.id, c.telefono]));
  }

  async listar(empresaId: string, filtros: FiltrosProyecto = {}) {
    const hoy = fechaHoyAR();
    const ahora = new Date();
    const where: Prisma.ProyectoWhereInput = { empresaId };

    if (!filtros.estado || filtros.estado === 'activos') {
      where.estado = { in: ['activo', 'pausado'] };
    } else if (filtros.estado === 'terminados') {
      where.estado = 'terminado';
    } else if (filtros.estado !== 'todos') {
      where.estado = filtros.estado;
    }

    if (filtros.responsableId) where.responsableId = filtros.responsableId;
    if (filtros.clienteId) where.clienteId = filtros.clienteId;

    const [proyectos, usuarios] = await Promise.all([
      this.prisma.proyecto.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          etapas: { orderBy: { orden: 'asc' } },
          miembros: true,
        },
      }),
      this.mapaUsuarios(empresaId),
    ]);

    const items = proyectos.map((p) => {
      const calc = estadoAtraso({
        estadoProyecto: p.estado as EstadoProyecto,
        fechaComprometida: isoDate(p.fechaComprometida),
        terminadoEn: p.terminadoEn,
        hoy,
        ahora,
        etapas: p.etapas.map((e) => ({
          id: e.id,
          orden: e.orden,
          nombre: e.nombre,
          estado: e.estado as EstadoEtapa,
          aprobacion: e.aprobacion as TipoAprobacion,
          falta: (e.falta as FaltaAprobacion) ?? null,
          fechaObjetivo: isoDate(e.fechaObjetivo),
          enRevisionDesde: e.enRevisionDesde,
        })),
      });
      const cerradas = p.etapas.filter((e) => e.estado === 'aprobada' || e.estado === 'omitida').length;
      const maxVersion = p.etapas.reduce((m, e) => Math.max(m, e.version), 1);

      return {
        id: p.id,
        numero: p.numero,
        codigo: codigoProyecto(p.numero),
        nombre: p.nombre,
        clienteId: p.clienteId,
        clienteNombre: p.clienteNombre,
        estado: p.estado as EstadoProyecto,
        responsableId: p.responsableId,
        responsableNombre: p.responsableId ? (usuarios.get(p.responsableId) ?? null) : null,
        plantillaId: p.plantillaId,
        plantillaNombre: p.plantillaNombre,
        fechaInicio: isoDate(p.fechaInicio)!,
        fechaComprometida: isoDate(p.fechaComprometida),
        montoAcordado: p.montoAcordado ? p.montoAcordado.toNumber() : null,
        etapaActual: calc.etapaActual,
        esperandoCliente: calc.esperandoCliente,
        diasEsperandoCliente: calc.diasEsperandoCliente,
        atrasado: calc.atrasado || Boolean(calc.etapaActual?.atrasada),
        diasAtraso: calc.diasAtraso,
        avance: {
          cerradas,
          total: p.etapas.length,
          porcentaje: p.etapas.length > 0 ? Math.round((cerradas / p.etapas.length) * 100) : 0,
        },
        maxVersion,
      };
    });

    if (filtros.atrasados === '1' || filtros.atrasados === 'true') {
      return items.filter((i) => i.atrasado);
    }
    return items;
  }

  async tablero(empresaId: string, filtros: FiltrosProyecto = {}) {
    const [proyectos, plantillas] = await Promise.all([
      this.listar(empresaId, { ...filtros, estado: filtros.estado ?? 'activos' }),
      this.plantillas.listar(empresaId),
    ]);

    const ordenEtapas: string[] = [];
    for (const pl of plantillas) {
      for (const et of pl.etapas) {
        if (!ordenEtapas.includes(et.nombre)) ordenEtapas.push(et.nombre);
      }
    }

    const mapaColumnas = new Map<string, typeof proyectos>();
    for (const p of proyectos) {
      const col = p.etapaActual?.nombre ?? 'Listo para cerrar';
      if (!ordenEtapas.includes(col)) ordenEtapas.push(col);
      mapaColumnas.set(col, [...(mapaColumnas.get(col) ?? []), p]);
    }

    return {
      columnas: ordenEtapas
        .filter((nombre) => (mapaColumnas.get(nombre)?.length ?? 0) > 0)
        .map((nombre) => ({
          nombre,
          proyectos: mapaColumnas.get(nombre) ?? [],
        })),
      total: proyectos.length,
    };
  }

  async metricas(empresaId: string, desde?: string, hasta?: string) {
    const hoy = fechaHoyAR();
    const where: Prisma.ProyectoWhereInput = {
      empresaId,
      estado: 'terminado',
    };
    if (desde || hasta) {
      where.terminadoEn = {
        ...(desde ? { gte: new Date(`${desde.slice(0, 10)}T00:00:00Z`) } : {}),
        ...(hasta ? { lte: new Date(`${hasta.slice(0, 10)}T23:59:59Z`) } : {}),
      };
    }

    const terminados = await this.prisma.proyecto.findMany({
      where,
      include: { etapas: true },
    });

    let aTiempo = 0;
    let sumaAtraso = 0;
    let conAtraso = 0;

    for (const p of terminados) {
      const calc = estadoAtraso({
        estadoProyecto: 'terminado',
        fechaComprometida: isoDate(p.fechaComprometida),
        terminadoEn: p.terminadoEn,
        hoy,
        etapas: [],
      });
      if (calc.atrasado) {
        conAtraso += 1;
        sumaAtraso += calc.diasAtraso;
      } else {
        aTiempo += 1;
      }
    }

    const todasEtapas = terminados.flatMap((p) =>
      p.etapas.map((e) => ({
        nombre: e.nombre,
        minutosTrabajo: e.minutosTrabajo,
        minutosEspera: e.minutosEspera,
        rondasCambios: e.rondasCambios,
      })),
    );
    const resumenEtapas = metricasEtapas(todasEtapas);

    return {
      terminados: terminados.length,
      aTiempoPorcentaje: terminados.length > 0 ? Math.round((aTiempo / terminados.length) * 100) : 100,
      atrasoPromedioDias:
        conAtraso > 0 ? Math.round((sumaAtraso / conAtraso) * 10) / 10 : 0,
      porEtapa: resumenEtapas.porEtapa,
      etapaMasDemorada: resumenEtapas.etapaMasDemorada,
    };
  }

  async ficha(empresaId: string, id: string) {
    const p = await this.prisma.proyecto.findFirst({
      where: { id, empresaId },
      include: {
        miembros: true,
        etapas: {
          orderBy: { orden: 'asc' },
          include: { aprobaciones: { orderBy: { createdAt: 'asc' } } },
        },
        eventos: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!p) throw new NotFoundException('Proyecto no encontrado');

    const [usuarios, telefonos, empresa] = await Promise.all([
      this.mapaUsuarios(empresaId),
      p.clienteId ? this.mapaClientesTelefono(empresaId, [p.clienteId]) : Promise.resolve(new Map<string, string | null>()),
      this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true } }),
    ]);

    const hoy = fechaHoyAR();
    const ahora = new Date();
    const calc = estadoAtraso({
      estadoProyecto: p.estado as EstadoProyecto,
      fechaComprometida: isoDate(p.fechaComprometida),
      terminadoEn: p.terminadoEn,
      hoy,
      ahora,
      etapas: p.etapas.map((e) => ({
        id: e.id,
        orden: e.orden,
        nombre: e.nombre,
        estado: e.estado as EstadoEtapa,
        aprobacion: e.aprobacion as TipoAprobacion,
        falta: (e.falta as FaltaAprobacion) ?? null,
        fechaObjetivo: isoDate(e.fechaObjetivo),
        enRevisionDesde: e.enRevisionDesde,
      })),
    });

    const cerradas = p.etapas.filter((e) => e.estado === 'aprobada' || e.estado === 'omitida').length;

    return {
      id: p.id,
      numero: p.numero,
      codigo: codigoProyecto(p.numero),
      nombre: p.nombre,
      negocioNombre: empresa?.nombre ?? null,
      clienteId: p.clienteId,
      clienteNombre: p.clienteNombre,
      clienteTelefono: p.clienteId ? (telefonos.get(p.clienteId) ?? null) : null,
      descripcion: p.descripcion,
      estado: p.estado as EstadoProyecto,
      responsableId: p.responsableId,
      responsableNombre: p.responsableId ? (usuarios.get(p.responsableId) ?? null) : null,
      plantillaId: p.plantillaId,
      plantillaNombre: p.plantillaNombre,
      fechaInicio: isoDate(p.fechaInicio)!,
      fechaComprometida: isoDate(p.fechaComprometida),
      montoAcordado: p.montoAcordado ? p.montoAcordado.toNumber() : null,
      presupuestoId: p.presupuestoId,
      terminadoEn: p.terminadoEn?.toISOString() ?? null,
      motivoCancelacion: p.motivoCancelacion,
      createdAt: p.createdAt.toISOString(),
      etapaActual: calc.etapaActual,
      esperandoCliente: calc.esperandoCliente,
      diasEsperandoCliente: calc.diasEsperandoCliente,
      atrasado: calc.atrasado || Boolean(calc.etapaActual?.atrasada),
      diasAtraso: calc.diasAtraso,
      avance: {
        cerradas,
        total: p.etapas.length,
        porcentaje: p.etapas.length > 0 ? Math.round((cerradas / p.etapas.length) * 100) : 0,
      },
      miembros: p.miembros.map((m) => ({
        usuarioId: m.usuarioId,
        nombre: usuarios.get(m.usuarioId) ?? 'Usuario',
      })),
      etapas: p.etapas.map((e) => ({
        id: e.id,
        orden: e.orden,
        nombre: e.nombre,
        estado: e.estado as EstadoEtapa,
        aprobacion: e.aprobacion as TipoAprobacion,
        falta: (e.falta as FaltaAprobacion) ?? null,
        responsableId: e.responsableId,
        responsableNombre: e.responsableId ? (usuarios.get(e.responsableId) ?? null) : null,
        aprobadorInternoId: e.aprobadorInternoId,
        aprobadorInternoNombre: e.aprobadorInternoId ? (usuarios.get(e.aprobadorInternoId) ?? null) : null,
        fechaObjetivo: isoDate(e.fechaObjetivo),
        atrasada: Boolean(
          e.fechaObjetivo &&
            isoDate(e.fechaObjetivo)! < hoy &&
            e.estado !== 'aprobada' &&
            e.estado !== 'omitida',
        ),
        version: e.version,
        iniciadaEn: e.iniciadaEn?.toISOString() ?? null,
        enRevisionDesde: e.enRevisionDesde?.toISOString() ?? null,
        cerradaEn: e.cerradaEn?.toISOString() ?? null,
        minutosTrabajo: e.minutosTrabajo,
        minutosEspera: e.minutosEspera,
        rondasCambios: e.rondasCambios,
        esActual: calc.etapaActual?.orden === e.orden,
        aprobaciones: e.aprobaciones.map((a) => ({
          id: a.id,
          tipo: a.tipo as 'interna' | 'cliente',
          resultado: a.resultado as 'aprobada' | 'cambios',
          version: a.version,
          aprobadorUsuarioId: a.aprobadorUsuarioId,
          aprobadorNombre: a.aprobadorNombre,
          medio: a.medio,
          comentario: a.comentario,
          evidenciaUrl: a.evidenciaUrl,
          aprobadoEn: a.aprobadoEn.toISOString(),
          registradoPorId: a.registradoPorId,
          registradoPorNombre: usuarios.get(a.registradoPorId) ?? 'Usuario',
        })),
      })),
      eventos: p.eventos.map((ev) => ({
        id: ev.id,
        etapaId: ev.etapaId,
        tipo: ev.tipo,
        detalle: ev.detalle as Record<string, unknown> | null,
        usuarioId: ev.usuarioId,
        usuarioNombre: ev.usuarioId ? (usuarios.get(ev.usuarioId) ?? 'Usuario') : 'Sistema',
        createdAt: ev.createdAt.toISOString(),
      })),
    };
  }

  async crear(empresaId: string, usuarioId: string, input: CrearProyectoInput) {
    let etapasInput = input.etapas ?? [];
    let plantillaNombre: string | null = null;

    if (input.plantillaId) {
      const pl = await this.prisma.plantillaProyecto.findFirst({
        where: { id: input.plantillaId, empresaId },
        include: { etapas: { orderBy: { orden: 'asc' } } },
      });
      if (!pl) throw new NotFoundException('Plantilla de proyecto no encontrada');
      plantillaNombre = pl.nombre;
      if (etapasInput.length === 0) {
        etapasInput = pl.etapas.map((e) => ({
          nombre: e.nombre,
          aprobacion: e.aprobacion as TipoAprobacion,
          diasObjetivo: e.diasObjetivo,
          aprobadorInternoId: e.aprobadorInternoId,
        }));
      }
    }

    if (etapasInput.length === 0) {
      throw new BadRequestException('El proyecto tiene que tener al menos una etapa');
    }

    let clienteNombre = input.clienteNombre?.trim() || null;
    if (input.clienteId) {
      const cli = await this.prisma.cliente.findFirst({
        where: { id: input.clienteId, empresaId },
        select: { nombre: true },
      });
      if (!cli) throw new BadRequestException('Cliente no encontrado');
      if (!clienteNombre) clienteNombre = cli.nombre;
    }

    const calculadas = fechasObjetivo(
      input.fechaInicio,
      etapasInput.map((e) => ({ diasObjetivo: e.diasObjetivo ?? null })),
      input.fechaComprometida,
    );

    const miembrosUnicos = [...new Set(input.miembros ?? [])];

    for (let intento = 0; intento < 3; intento++) {
      try {
        const proyectoId = await this.prisma.$transaction(async (tx) => {
          const maxNum = await tx.proyecto.aggregate({
            where: { empresaId },
            _max: { numero: true },
          });
          const numero = (maxNum._max.numero ?? 0) + 1;

          const creado = await tx.proyecto.create({
            data: {
              empresaId,
              numero,
              nombre: input.nombre.trim(),
              clienteId: input.clienteId ?? null,
              clienteNombre,
              descripcion: input.descripcion?.trim() || null,
              estado: 'activo',
              responsableId: input.responsableId ?? null,
              plantillaId: input.plantillaId ?? null,
              plantillaNombre,
              fechaInicio: new Date(`${input.fechaInicio.slice(0, 10)}T00:00:00Z`),
              fechaComprometida: input.fechaComprometida
                ? new Date(`${input.fechaComprometida.slice(0, 10)}T00:00:00Z`)
                : null,
              montoAcordado: input.montoAcordado ?? null,
              presupuestoId: input.presupuestoId ?? null,
              usuarioId,
              miembros: {
                create: miembrosUnicos.map((uid) => ({ usuarioId: uid })),
              },
              etapas: {
                create: etapasInput.map((e, idx) => {
                  const fObj = e.fechaObjetivo ?? calculadas.fechas[idx];
                  return {
                    orden: idx + 1,
                    nombre: e.nombre.trim(),
                    estado: 'pendiente',
                    aprobacion: e.aprobacion ?? 'ninguna',
                    responsableId: e.responsableId ?? input.responsableId ?? null,
                    aprobadorInternoId: e.aprobadorInternoId ?? null,
                    fechaObjetivo: fObj ? new Date(`${fObj.slice(0, 10)}T00:00:00Z`) : null,
                  };
                }),
              },
              eventos: {
                create: {
                  tipo: 'creado',
                  usuarioId,
                  detalle: { nombre: input.nombre.trim(), plantilla: plantillaNombre },
                },
              },
            },
          });
          return creado.id;
        });

        return this.ficha(empresaId, proyectoId);
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && intento < 2) {
          continue;
        }
        throw e;
      }
    }
    throw new ConflictException('No se pudo asignar el número del proyecto. Intentá de nuevo.');
  }

  async desdePresupuesto(
    empresaId: string,
    usuarioId: string,
    presupuestoId: string,
    input: Omit<CrearProyectoInput, 'clienteId' | 'clienteNombre' | 'montoAcordado' | 'presupuestoId'>,
  ) {
    const pres = await this.prisma.presupuesto.findFirst({
      where: { id: presupuestoId, empresaId },
      select: {
        id: true,
        clienteId: true,
        clienteNombre: true,
        descuento: true,
        estado: true,
        items: { select: { cantidad: true, precioUnitario: true } },
      },
    });
    if (!pres) throw new NotFoundException('Presupuesto no encontrado');

    const existente = await this.prisma.proyecto.findFirst({
      where: { presupuestoId, empresaId },
      select: { id: true },
    });
    if (existente) throw new ConflictException('Ese presupuesto ya fue convertido en un proyecto');

    const subtotal = pres.items.reduce((s, i) => s + i.cantidad * i.precioUnitario.toNumber(), 0);
    const totalPresupuesto = Math.max(0, subtotal - pres.descuento.toNumber());

    const ficha = await this.crear(empresaId, usuarioId, {
      ...input,
      clienteId: pres.clienteId,
      clienteNombre: pres.clienteNombre,
      montoAcordado: totalPresupuesto,
      presupuestoId: pres.id,
    });

    await this.prisma.presupuesto.update({
      where: { id: pres.id },
      data: { estado: 'aceptado' },
    });

    return ficha;
  }

  async editar(
    empresaId: string,
    usuarioId: string,
    id: string,
    input: {
      nombre?: string;
      clienteId?: string | null;
      clienteNombre?: string | null;
      descripcion?: string | null;
      responsableId?: string | null;
      miembros?: string[];
      fechaInicio?: string;
      fechaComprometida?: string | null;
      montoAcordado?: number | null;
    },
  ) {
    const existente = await this.prisma.proyecto.findFirst({
      where: { id, empresaId },
      select: { id: true },
    });
    if (!existente) throw new NotFoundException('Proyecto no encontrado');

    await this.prisma.$transaction(async (tx) => {
      if (input.miembros) {
        const unicos = [...new Set(input.miembros)];
        await tx.proyectoMiembro.deleteMany({ where: { proyectoId: id } });
        if (unicos.length > 0) {
          await tx.proyectoMiembro.createMany({
            data: unicos.map((u) => ({ proyectoId: id, usuarioId: u })),
          });
        }
      }
      await tx.proyecto.update({
        where: { id },
        data: {
          ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
          ...(input.clienteId !== undefined ? { clienteId: input.clienteId } : {}),
          ...(input.clienteNombre !== undefined ? { clienteNombre: input.clienteNombre?.trim() || null } : {}),
          ...(input.descripcion !== undefined ? { descripcion: input.descripcion?.trim() || null } : {}),
          ...(input.responsableId !== undefined ? { responsableId: input.responsableId } : {}),
          ...(input.fechaInicio !== undefined
            ? { fechaInicio: new Date(`${input.fechaInicio.slice(0, 10)}T00:00:00Z`) }
            : {}),
          ...(input.fechaComprometida !== undefined
            ? {
                fechaComprometida: input.fechaComprometida
                  ? new Date(`${input.fechaComprometida.slice(0, 10)}T00:00:00Z`)
                  : null,
              }
            : {}),
          ...(input.montoAcordado !== undefined ? { montoAcordado: input.montoAcordado } : {}),
        },
      });
      await tx.proyectoEvento.create({
        data: {
          proyectoId: id,
          tipo: 'editado',
          usuarioId,
        },
      });
    });

    return this.ficha(empresaId, id);
  }

  async editarEtapa(
    empresaId: string,
    usuarioId: string,
    proyectoId: string,
    etapaId: string,
    input: {
      responsableId?: string | null;
      aprobadorInternoId?: string | null;
      fechaObjetivo?: string | null;
      nombre?: string;
    },
  ) {
    const etapa = await this.prisma.proyectoEtapa.findFirst({
      where: { id: etapaId, proyectoId, proyecto: { empresaId } },
    });
    if (!etapa) throw new NotFoundException('Etapa no encontrada');

    await this.prisma.$transaction(async (tx) => {
      await tx.proyectoEtapa.update({
        where: { id: etapaId },
        data: {
          ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
          ...(input.responsableId !== undefined ? { responsableId: input.responsableId } : {}),
          ...(input.aprobadorInternoId !== undefined ? { aprobadorInternoId: input.aprobadorInternoId } : {}),
          ...(input.fechaObjetivo !== undefined
            ? {
                fechaObjetivo: input.fechaObjetivo
                  ? new Date(`${input.fechaObjetivo.slice(0, 10)}T00:00:00Z`)
                  : null,
              }
            : {}),
        },
      });
      await tx.proyectoEvento.create({
        data: {
          proyectoId,
          etapaId,
          tipo: 'responsable',
          usuarioId,
          detalle: {
            etapa: input.nombre ?? etapa.nombre,
            responsableId: input.responsableId ?? etapa.responsableId,
            fechaObjetivo: input.fechaObjetivo ?? isoDate(etapa.fechaObjetivo),
          },
        },
      });
    });

    return this.ficha(empresaId, proyectoId);
  }

  async agregarEtapa(
    empresaId: string,
    usuarioId: string,
    proyectoId: string,
    input: {
      nombre: string;
      aprobacion?: TipoAprobacion;
      responsableId?: string | null;
      aprobadorInternoId?: string | null;
      fechaObjetivo?: string | null;
      orden?: number;
    },
  ) {
    const proyecto = await this.prisma.proyecto.findFirst({
      where: { id: proyectoId, empresaId },
      include: { etapas: { orderBy: { orden: 'asc' } } },
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');

    await this.prisma.$transaction(async (tx) => {
      const maxOrden = proyecto.etapas.reduce((m, e) => Math.max(m, e.orden), 0);
      const ordenDestino = input.orden && input.orden <= maxOrden ? input.orden : maxOrden + 1;

      if (ordenDestino <= maxOrden) {
        await tx.proyectoEtapa.updateMany({
          where: { proyectoId, orden: { gte: ordenDestino } },
          data: { orden: { increment: 1 } },
        });
      }

      const nueva = await tx.proyectoEtapa.create({
        data: {
          proyectoId,
          orden: ordenDestino,
          nombre: input.nombre.trim(),
          estado: 'pendiente',
          aprobacion: input.aprobacion ?? 'ninguna',
          responsableId: input.responsableId ?? proyecto.responsableId ?? null,
          aprobadorInternoId: input.aprobadorInternoId ?? null,
          fechaObjetivo: input.fechaObjetivo
            ? new Date(`${input.fechaObjetivo.slice(0, 10)}T00:00:00Z`)
            : null,
        },
      });

      await tx.proyectoEvento.create({
        data: {
          proyectoId,
          etapaId: nueva.id,
          tipo: 'editado',
          usuarioId,
          detalle: { accion: 'etapa_agregada', etapa: nueva.nombre },
        },
      });
    });

    return this.ficha(empresaId, proyectoId);
  }

  async accionEtapa(
    empresaId: string,
    usuario: UsuarioContext,
    proyectoId: string,
    etapaId: string,
    input: { accion: 'empezar' | 'enviar_revision' | 'terminar' | 'omitir'; nota?: string | null },
  ) {
    const proyecto = await this.prisma.proyecto.findFirst({
      where: { id: proyectoId, empresaId },
      include: { etapas: { orderBy: { orden: 'asc' } } },
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
    if (proyecto.estado !== 'activo') {
      throw new BadRequestException('El proyecto no está activo');
    }

    const etapa = proyecto.etapas.find((e) => e.id === etapaId);
    if (!etapa) throw new NotFoundException('Etapa no encontrada');

    if (
      !puedeOperarEtapa({
        usuarioId: usuario.id,
        esDueno: usuario.rol === 'dueno',
        responsableProyectoId: proyecto.responsableId,
        responsableEtapaId: etapa.responsableId,
      })
    ) {
      throw new ForbiddenException('Solo el responsable de la etapa, del proyecto o el dueño puede hacer esta acción');
    }

    const primeraAbierta = proyecto.etapas.find((e) => e.estado !== 'aprobada' && e.estado !== 'omitida');
    const esEtapaActual = primeraAbierta?.id === etapa.id;

    const resultado = transicionEtapa(
      {
        id: etapa.id,
        orden: etapa.orden,
        nombre: etapa.nombre,
        estado: etapa.estado as EstadoEtapa,
        aprobacion: etapa.aprobacion as TipoAprobacion,
        falta: (etapa.falta as FaltaAprobacion) ?? null,
        version: etapa.version,
        iniciadaEn: etapa.iniciadaEn,
        enRevisionDesde: etapa.enRevisionDesde,
        cerradaEn: etapa.cerradaEn,
        minutosTrabajo: etapa.minutosTrabajo,
        minutosEspera: etapa.minutosEspera,
        rondasCambios: etapa.rondasCambios,
      },
      input.accion,
      { esEtapaActual, nota: input.nota },
    );

    if (!resultado.ok) {
      if (resultado.codigo === 409) throw new ConflictException(resultado.motivo);
      throw new BadRequestException(resultado.motivo);
    }

    const tipoEvento =
      input.accion === 'empezar'
        ? 'etapa_iniciada'
        : input.accion === 'enviar_revision'
          ? 'enviada_revision'
          : input.accion === 'terminar'
            ? 'aprobada'
            : 'omitida';

    await this.prisma.$transaction(async (tx) => {
      await tx.proyectoEtapa.update({
        where: { id: etapaId },
        data: resultado.cambios,
      });
      await tx.proyectoEvento.create({
        data: {
          proyectoId,
          etapaId,
          tipo: tipoEvento,
          usuarioId: usuario.id,
          detalle: {
            etapa: etapa.nombre,
            version: resultado.cambios.version,
            ...(input.nota ? { nota: input.nota.trim() } : {}),
          },
        },
      });
    });

    return this.ficha(empresaId, proyectoId);
  }

  async aprobacionInterna(
    empresaId: string,
    usuario: UsuarioContext,
    proyectoId: string,
    etapaId: string,
    input: { resultado: 'aprobada' | 'cambios'; version: number; comentario?: string | null },
  ) {
    const proyecto = await this.prisma.proyecto.findFirst({
      where: { id: proyectoId, empresaId },
      include: { etapas: true },
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');

    const etapa = proyecto.etapas.find((e) => e.id === etapaId);
    if (!etapa) throw new NotFoundException('Etapa no encontrada');

    const ultimoEnvio = await this.prisma.proyectoEvento.findFirst({
      where: { proyectoId, etapaId, tipo: 'enviada_revision' },
      orderBy: { createdAt: 'desc' },
      select: { usuarioId: true },
    });

    const permiso = puedeAprobarInternamente({
      usuarioId: usuario.id,
      esDueno: usuario.rol === 'dueno',
      aprobadorInternoId: etapa.aprobadorInternoId,
      responsableProyectoId: proyecto.responsableId,
      enviadoPorUsuarioId: ultimoEnvio?.usuarioId ?? null,
    });
    if (!permiso.ok) {
      throw new ForbiddenException(permiso.motivo);
    }

    const accion = input.resultado === 'aprobada' ? 'aprobar' : 'pedir_cambios';
    const transicion = transicionEtapa(
      {
        id: etapa.id,
        orden: etapa.orden,
        nombre: etapa.nombre,
        estado: etapa.estado as EstadoEtapa,
        aprobacion: etapa.aprobacion as TipoAprobacion,
        falta: (etapa.falta as FaltaAprobacion) ?? null,
        version: etapa.version,
        iniciadaEn: etapa.iniciadaEn,
        enRevisionDesde: etapa.enRevisionDesde,
        cerradaEn: etapa.cerradaEn,
        minutosTrabajo: etapa.minutosTrabajo,
        minutosEspera: etapa.minutosEspera,
        rondasCambios: etapa.rondasCambios,
      },
      accion,
      {
        tipoAprobador: 'interna',
        versionAprobada: input.version,
        comentario: input.comentario,
      },
    );

    if (!transicion.ok) {
      if (transicion.codigo === 409) throw new ConflictException(transicion.motivo);
      throw new BadRequestException(transicion.motivo);
    }

    const usuarioDatos = await this.prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: { nombre: true, email: true },
    });
    const aprobadorNombre = usuarioDatos?.nombre || usuarioDatos?.email || 'Usuario';

    await this.prisma.$transaction(async (tx) => {
      await tx.proyectoEtapa.update({
        where: { id: etapaId },
        data: transicion.cambios,
      });
      await tx.proyectoAprobacion.create({
        data: {
          etapaId,
          tipo: 'interna',
          resultado: input.resultado,
          version: input.version,
          aprobadorUsuarioId: usuario.id,
          aprobadorNombre,
          medio: 'en_sistema',
          comentario: input.comentario?.trim() || null,
          aprobadoEn: new Date(),
          registradoPorId: usuario.id,
        },
      });
      await tx.proyectoEvento.create({
        data: {
          proyectoId,
          etapaId,
          tipo: input.resultado === 'aprobada' ? 'aprobada' : 'cambios',
          usuarioId: usuario.id,
          detalle: {
            etapa: etapa.nombre,
            tipo: 'interna',
            version: input.version,
            aprobadorNombre,
            comentario: input.comentario?.trim() || null,
          },
        },
      });
    });

    return this.ficha(empresaId, proyectoId);
  }

  async respuestaCliente(
    empresaId: string,
    usuario: UsuarioContext,
    proyectoId: string,
    etapaId: string,
    input: {
      resultado: 'aprobada' | 'cambios';
      version: number;
      aprobadorNombre: string;
      medio: 'whatsapp' | 'email' | 'reunion' | 'en_persona' | 'link';
      aprobadoEn: string;
      comentario?: string | null;
      evidenciaUrl?: string | null;
    },
  ) {
    const proyecto = await this.prisma.proyecto.findFirst({
      where: { id: proyectoId, empresaId },
      include: { etapas: true },
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');

    const etapa = proyecto.etapas.find((e) => e.id === etapaId);
    if (!etapa) throw new NotFoundException('Etapa no encontrada');

    const fechaAprobado = new Date(input.aprobadoEn);
    if (Number.isNaN(fechaAprobado.getTime())) {
      throw new BadRequestException('Fecha de aprobación inválida');
    }
    if (fechaAprobado.getTime() > Date.now() + 5 * 60_000) {
      throw new BadRequestException('La fecha de aprobación no puede estar en el futuro');
    }

    const accion = input.resultado === 'aprobada' ? 'aprobar' : 'pedir_cambios';
    const transicion = transicionEtapa(
      {
        id: etapa.id,
        orden: etapa.orden,
        nombre: etapa.nombre,
        estado: etapa.estado as EstadoEtapa,
        aprobacion: etapa.aprobacion as TipoAprobacion,
        falta: (etapa.falta as FaltaAprobacion) ?? null,
        version: etapa.version,
        iniciadaEn: etapa.iniciadaEn,
        enRevisionDesde: etapa.enRevisionDesde,
        cerradaEn: etapa.cerradaEn,
        minutosTrabajo: etapa.minutosTrabajo,
        minutosEspera: etapa.minutosEspera,
        rondasCambios: etapa.rondasCambios,
      },
      accion,
      {
        tipoAprobador: 'cliente',
        versionAprobada: input.version,
        comentario: input.comentario,
      },
    );

    if (!transicion.ok) {
      if (transicion.codigo === 409) throw new ConflictException(transicion.motivo);
      throw new BadRequestException(transicion.motivo);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.proyectoEtapa.update({
        where: { id: etapaId },
        data: transicion.cambios,
      });
      await tx.proyectoAprobacion.create({
        data: {
          etapaId,
          tipo: 'cliente',
          resultado: input.resultado,
          version: input.version,
          aprobadorUsuarioId: null,
          aprobadorNombre: input.aprobadorNombre.trim(),
          medio: input.medio,
          comentario: input.comentario?.trim() || null,
          evidenciaUrl: input.evidenciaUrl?.trim() || null,
          aprobadoEn: fechaAprobado,
          registradoPorId: usuario.id,
        },
      });
      await tx.proyectoEvento.create({
        data: {
          proyectoId,
          etapaId,
          tipo: input.resultado === 'aprobada' ? 'aprobada' : 'cambios',
          usuarioId: usuario.id,
          detalle: {
            etapa: etapa.nombre,
            tipo: 'cliente',
            version: input.version,
            aprobadorNombre: input.aprobadorNombre.trim(),
            medio: input.medio,
            comentario: input.comentario?.trim() || null,
          },
        },
      });
    });

    return this.ficha(empresaId, proyectoId);
  }

  async cambiarEstado(
    empresaId: string,
    usuarioId: string,
    id: string,
    input: { estado: 'pausado' | 'activo' | 'terminado' | 'cancelado'; motivo?: string | null },
  ) {
    const proyecto = await this.prisma.proyecto.findFirst({
      where: { id, empresaId },
      include: { etapas: true },
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');

    if (input.estado === 'terminado') {
      const abiertas = proyecto.etapas.filter((e) => e.estado !== 'aprobada' && e.estado !== 'omitida');
      if (abiertas.length > 0) {
        throw new BadRequestException('Para terminar el proyecto, todas las etapas tienen que estar aprobadas u omitidas');
      }
    }

    if (input.estado === 'cancelado' && !input.motivo?.trim()) {
      throw new BadRequestException('Contá por qué se cancela el proyecto');
    }

    const tipoEvento =
      input.estado === 'pausado'
        ? 'pausado'
        : input.estado === 'activo'
          ? 'reanudado'
          : input.estado === 'terminado'
            ? 'terminado'
            : 'cancelado';

    await this.prisma.$transaction(async (tx) => {
      await tx.proyecto.update({
        where: { id },
        data: {
          estado: input.estado,
          terminadoEn: input.estado === 'terminado' ? new Date() : proyecto.terminadoEn,
          motivoCancelacion: input.estado === 'cancelado' ? input.motivo!.trim() : proyecto.motivoCancelacion,
        },
      });
      await tx.proyectoEvento.create({
        data: {
          proyectoId: id,
          tipo: tipoEvento,
          usuarioId,
          detalle: input.motivo ? { motivo: input.motivo.trim() } : undefined,
        },
      });
    });

    return this.ficha(empresaId, id);
  }
}
