import { BadGatewayException, BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation.js';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { ClerkCuentasService } from './clerk-cuentas.service.js';
import { CuponesService, normalizarCuit, type Verificacion } from '../alianzas/cupones.service.js';
import { finDePrueba, limpiarNombre, normalizarTelefono, PLAN_PRUEBA, resumenPrimerosPasos, type PrimerosPasos } from './registro.util.js';

export interface RegistroInput {
  nombreNegocio: string;
  rubro: string;
  telefono: string;
  origen: string | null;
  /** Código de una cámara o cupón (opcional). */
  codigo?: string | null;
  cuit?: string | null;
}

export interface RegistroRespuesta {
  clerkOrgId: string;
  empresaId: string;
  finPrueba: string | null;
  /** Ya estaba registrado (reintento): se devuelve su empresa. */
  yaExistia: boolean;
  /** Código aplicado: de qué cámara y si recibió la prueba extendida. */
  cupon?: { codigo: string; camara: string | null; mesGratis: boolean; diasPrueba: number; aviso: string | null } | null;
}

@Injectable()
export class RegistroService {
  private readonly logger = new Logger(RegistroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clerk: ClerkCuentasService,
    private readonly config: ConfigService<Env, true>,
    private readonly cupones: CuponesService,
  ) {}

  /**
   * Alta de una empresa nueva con 14 días de prueba: crea la organización en
   * Clerk y, en una transacción, la empresa, el dueño, la suscripción de
   * prueba, la aceptación de términos y el aviso para la consola. No depende
   * del webhook de Clerk (que llega después y es idempotente).
   */
  async registrar(clerkUserId: string, input: RegistroInput, userAgent: string | null): Promise<RegistroRespuesta> {
    const existente = await this.prisma.usuario.findFirst({
      where: { clerkUserId, deletedAt: null },
      select: { rolCrudo: true, empresa: { select: { id: true, clerkOrgId: true, deletedAt: true } } },
    });
    if (existente && !existente.empresa.deletedAt) {
      // Doble click o reintento: ya es dueño de su empresa.
      if (existente.rolCrudo === 'dueno' && existente.empresa.clerkOrgId) {
        return { clerkOrgId: existente.empresa.clerkOrgId, empresaId: existente.empresa.id, finPrueba: null, yaExistia: true };
      }
      throw new ConflictException('Tu usuario ya forma parte de otra empresa. Para crear un negocio propio registrate con otro email.');
    }

    const nombre = limpiarNombre(input.nombreNegocio);
    const telefono = normalizarTelefono(input.telefono);
    const datos = await this.clerk.usuario(clerkUserId);
    const cuit = normalizarCuit(input.cuit);
    if (input.cuit?.trim() && !cuit) throw new BadRequestException('El CUIT tiene que tener 11 números');
    // El código se valida antes de crear nada: si no sirve, se avisa y puede seguir sin código.
    let codigo: Extract<Verificacion, { ok: true }> | null = null;
    if (input.codigo?.trim()) {
      const v = await this.cupones.verificar(input.codigo, { email: datos.email, clerkUserId, cuit });
      if (!v.ok) throw new BadRequestException(v.mensaje);
      codigo = v;
    }
    let clerkOrgId: string;
    try {
      clerkOrgId = await this.clerk.crearOrganizacion(nombre, clerkUserId);
    } catch (e) {
      this.logger.error(`No se pudo crear la organización en Clerk: ${String(e)}`);
      throw new BadGatewayException('No pudimos crear tu empresa en este momento. Probá de nuevo en un ratito.');
    }
    // No frena el alta: si falla, el botón igual está oculto en la web y la cuenta se puede corregir con el script.
    await this.clerk.bloquearCrearOrganizaciones(clerkUserId).catch((e) => this.logger.warn(`No se pudo quitar "crear organizaciones" a ${clerkUserId}: ${String(e)}`));

    const hoy = fechaHoyAR();
    // La prueba del cupón reemplaza a los 14 días (no se suman), si le corresponde.
    const finPrueba = finDePrueba(hoy, codigo?.diasPrueba);
    const origen = {
      cuit,
      camaraId: codigo?.cupon.camaraId ?? null,
      cuponId: codigo?.cupon.id ?? null,
      pruebaDesde: new Date(`${hoy}T00:00:00Z`),
      pruebaHasta: new Date(`${finPrueba}T00:00:00Z`),
    };
    let empresaId: string;
    try {
      empresaId = await this.prisma.$transaction(async (tx) => {
        // upsert: el webhook de Clerk puede haber llegado antes y creado la empresa.
        const empresa = await tx.empresa.upsert({
          where: { clerkOrgId },
          create: { clerkOrgId, nombre, rubro: input.rubro, telefono, origenRegistro: input.origen, planActual: PLAN_PRUEBA, ...origen },
          update: { nombre, rubro: input.rubro, telefono, origenRegistro: input.origen, planActual: PLAN_PRUEBA, ...origen },
        });
        const usuario = await tx.usuario.upsert({
          where: { clerkUserId },
          create: { clerkUserId, empresaId: empresa.id, nombre: datos.nombre, email: datos.email, rolCrudo: 'dueno' },
          update: { empresaId: empresa.id, nombre: datos.nombre, email: datos.email, rolCrudo: 'dueno', deletedAt: null, activo: true },
        });
        const plan = await tx.plan.findFirst({ where: { nombre: PLAN_PRUEBA }, select: { id: true } });
        if (!(await tx.suscripcion.findFirst({ where: { empresaId: empresa.id }, select: { id: true } }))) {
          await tx.suscripcion.create({
            data: { empresaId: empresa.id, planId: plan?.id ?? null, estado: 'periodo_prueba', fechaInicio: new Date(`${hoy}T00:00:00Z`), fechaVencimiento: new Date(`${finPrueba}T00:00:00Z`) },
          });
        }
        if (codigo) await this.cupones.registrarUso(tx, codigo.cupon.id, { email: datos.email, clerkUserId, empresaId: empresa.id, cuit }, codigo.mesGratis);
        await tx.aceptacionTerminos.create({ data: { empresaId: empresa.id, usuarioId: usuario.id, version: '1.1', userAgent } });
        await tx.avisoAdmin.create({
          data: {
            tipo: 'registro',
            titulo: `Nuevo registro: ${nombre}`,
            empresaId: empresa.id,
            detalle: { nombre, rubro: input.rubro, telefono, origen: input.origen, dueno: datos.nombre, email: datos.email, finPrueba, codigo: codigo?.cupon.codigo ?? null, camara: codigo?.cupon.camaraNombre ?? null },
          },
        });
        return empresa.id;
      });
    } catch (e) {
      // Sin empresa en la base, la organización de Clerk quedaría huérfana.
      await this.clerk.borrarOrganizacion(clerkOrgId).catch((err) => this.logger.error(`No se pudo borrar la organización ${clerkOrgId}: ${String(err)}`));
      throw e;
    }

    await this.avisarPorEmail(nombre, input, telefono, datos, finPrueba, codigo?.cupon.codigo ?? null);
    const cupon = codigo
      ? { codigo: codigo.cupon.codigo, camara: codigo.cupon.camaraNombre, mesGratis: codigo.mesGratis, diasPrueba: codigo.diasPrueba, aviso: codigo.aviso }
      : null;
    return { clerkOrgId, empresaId, finPrueba, yaExistia: false, cupon };
  }

  /** Aviso por email (opcional, con Resend). Nunca hace fallar el registro. */
  private async avisarPorEmail(nombre: string, input: RegistroInput, telefono: string, datos: { nombre: string; email: string }, finPrueba: string, codigo: string | null) {
    const clave = this.config.get('RESEND_API_KEY', { infer: true });
    if (!clave) return;
    try {
      const destino = this.config.get('AVISOS_EMAIL', { infer: true });
      const para = destino ? destino.split(',').map((e) => e.trim()) : (await this.prisma.adminEmail.findMany({ select: { email: true } })).map((a) => a.email);
      if (para.length === 0) return;
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.config.get('AVISOS_EMAIL_DESDE', { infer: true }),
          to: para,
          subject: `Nuevo registro en Analítica 360: ${nombre}`,
          text: [
            `Negocio: ${nombre} (${input.rubro})`,
            `Dueño: ${datos.nombre} <${datos.email}>`,
            `WhatsApp: https://wa.me/${telefono.replace(/\D/g, '')}`,
            `Nos conoció por: ${input.origen ?? '—'}`,
            `Código: ${codigo ?? '—'}`,
            `La prueba termina el ${finPrueba.split('-').reverse().join('/')}.`,
          ].join('\n'),
        }),
      });
      if (!r.ok) this.logger.warn(`Resend respondió ${r.status}`);
    } catch (e) {
      this.logger.warn(`No se pudo mandar el aviso por email: ${String(e)}`);
    }
  }

  /** Guía de arranque para la pantalla de Inicio. */
  async primerosPasos(empresaId: string) {
    const [empresa, productos, ventas, compras, usuarios, config] = await Promise.all([
      this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { createdAt: true } }),
      this.prisma.producto.count({ where: { empresaId, deletedAt: null } }),
      this.prisma.venta.count({ where: { empresaId, deletedAt: null } }),
      this.prisma.compra.count({ where: { empresaId, deletedAt: null } }),
      this.prisma.usuario.count({ where: { empresaId, deletedAt: null } }),
      this.prisma.configuracionEmpresa.findUnique({ where: { empresaId }, select: { condicionFiscal: true, categoriaMonotributo: true } }),
    ]);
    const pasos: PrimerosPasos = {
      productos: productos > 0,
      venta: ventas > 0,
      compra: compras > 0,
      equipo: usuarios > 1,
      datosFiscales: Boolean(config && (config.condicionFiscal !== 'monotributo' || config.categoriaMonotributo)),
    };
    const dias = empresa ? Math.floor((Date.now() - empresa.createdAt.getTime()) / 86_400_000) : 999;
    return { pasos, ...resumenPrimerosPasos(pasos, dias) };
  }
}
