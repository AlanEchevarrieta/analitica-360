import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { AccesoCuentaService } from '../planes/acceso-cuenta.service.js';
import { finDePrueba } from '../registro/registro.util.js';
import {
  diasDePrueba,
  normalizarCodigo,
  puedeUsarPruebaDelCupon,
  validarCupon,
  type HistorialPrueba,
  type ReglasCupon,
} from './alianzas.util.js';

type Db = PrismaService | Prisma.TransactionClient;

/** Quién intenta usar el código: lo que se controla para que el mes gratis sea de un solo uso. */
export interface QuienUsa {
  email?: string | null;
  clerkUserId?: string | null;
  empresaId?: string | null;
  cuit?: string | null;
}

export interface CuponVerificado {
  id: string;
  codigo: string;
  tipo: string;
  camaraId: string | null;
  camaraNombre: string | null;
  diasPrueba: number | null;
  reglas: ReglasCupon;
}

export type Verificacion =
  | { ok: false; mensaje: string }
  | {
      ok: true;
      cupon: CuponVerificado;
      /** Le corresponde la prueba extendida del cupón (de un solo uso). */
      mesGratis: boolean;
      /** Días de prueba que le tocan (los del cupón o los 14 comunes). */
      diasPrueba: number;
      /** Mensaje para el emprendedor (ej. que ya usó el mes gratis pero igual tiene los descuentos). */
      aviso: string | null;
    };

/** CUIT solo con números (11 dígitos) o null. */
export function normalizarCuit(cuit: string | null | undefined): string | null {
  const d = (cuit ?? '').replace(/\D/g, '');
  return d.length === 11 ? d : null;
}

@Injectable()
export class CuponesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accesoCuenta: AccesoCuentaService,
  ) {}

  private async buscar(db: Db, codigo: string) {
    return db.cupon.findUnique({ where: { codigo: normalizarCodigo(codigo) }, include: { camara: { select: { nombre: true, activa: true } } } });
  }

  /**
   * ¿Ya usó una prueba? Por email, usuario de Clerk, empresa o CUIT (usos del
   * beneficio) y por pruebas anteriores con otras empresas. `empresaActual`
   * no cuenta como "prueba anterior" (puede cargar el código durante su prueba).
   */
  async historialPrueba(db: Db, q: QuienUsa, empresaActual?: string | null): Promise<HistorialPrueba> {
    const email = q.email?.trim().toLowerCase() || null;
    const cuit = normalizarCuit(q.cuit);
    const usoCon = (where: Prisma.CuponUsoWhereInput) => db.cuponUso.count({ where: { conPrueba: true, ...where } }).then((n) => n > 0);
    const [emailUso, usuarioUso, empresaUso, cuitUso, otrasEmpresas] = await Promise.all([
      email ? usoCon({ email: { equals: email, mode: 'insensitive' } }) : false,
      q.clerkUserId ? usoCon({ clerkUserId: q.clerkUserId }) : false,
      q.empresaId ? usoCon({ empresaId: q.empresaId }) : false,
      cuit ? usoCon({ cuit }) : false,
      // Pruebas anteriores: otras empresas del mismo email/usuario o con el mismo CUIT.
      db.empresa.count({
        where: {
          id: empresaActual ? { not: empresaActual } : undefined,
          OR: [
            ...(email || q.clerkUserId
              ? [{ usuarios: { some: { OR: [...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []), ...(q.clerkUserId ? [{ clerkUserId: q.clerkUserId }] : [])] } } }]
              : []),
            ...(cuit ? [{ cuit }] : []),
          ],
          suscripciones: { some: {} },
        },
      }),
    ]);
    return { emailUsoBeneficio: emailUso, usuarioUsoBeneficio: usuarioUso, empresaUsoBeneficio: empresaUso, cuitUsoBeneficio: cuitUso, tuvoPrueba: otrasEmpresas > 0 };
  }

  /** Valida el código y dice qué beneficios le tocan a esta persona. No guarda nada. */
  async verificar(codigo: string, quien: QuienUsa, empresaActual?: string | null, db: Db = this.prisma): Promise<Verificacion> {
    const hoy = fechaHoyAR();
    const cupon = await this.buscar(db, codigo);
    const v = validarCupon(
      cupon && {
        activo: cupon.activo,
        desde: cupon.desde?.toISOString().slice(0, 10) ?? null,
        hasta: cupon.hasta?.toISOString().slice(0, 10) ?? null,
        maxUsos: cupon.maxUsos,
        usos: cupon.usos,
        camaraActiva: cupon.camara ? cupon.camara.activa : null,
      },
      hoy,
    );
    if (!v.ok) return { ok: false, mensaje: v.mensaje };

    const historial = await this.historialPrueba(db, quien, empresaActual);
    const conPruebaPropia = Boolean(cupon!.diasPrueba);
    const mesGratis = conPruebaPropia && puedeUsarPruebaDelCupon(historial);
    return {
      ok: true,
      cupon: {
        id: cupon!.id,
        codigo: cupon!.codigo,
        tipo: cupon!.tipo,
        camaraId: cupon!.camaraId,
        camaraNombre: cupon!.camara?.nombre ?? null,
        diasPrueba: cupon!.diasPrueba,
        reglas: (cupon!.reglas ?? {}) as ReglasCupon,
      },
      mesGratis,
      diasPrueba: diasDePrueba(cupon!.diasPrueba, mesGratis),
      aviso:
        conPruebaPropia && !mesGratis
          ? 'Ya usaste una prueba gratis antes, así que no corresponde el mes gratis. Igual queda registrado el código y tenés sus descuentos al pagar.'
          : null,
    };
  }

  /** Registra el uso del cupón (quién y cuándo) y suma uno a sus usos. */
  async registrarUso(db: Db, cuponId: string, quien: QuienUsa, conPrueba: boolean) {
    await db.cuponUso.create({
      data: {
        cuponId,
        empresaId: quien.empresaId ?? null,
        clerkUserId: quien.clerkUserId ?? null,
        email: quien.email?.trim().toLowerCase() || null,
        cuit: normalizarCuit(quien.cuit),
        conPrueba,
      },
    });
    await db.cupon.update({ where: { id: cuponId }, data: { usos: { increment: 1 } } });
  }

  /**
   * Código cargado después del registro (desde Planes). Si sigue en su prueba
   * y le corresponde, la prueba pasa a durar lo del cupón desde el alta
   * (reemplaza a los 14 días, no se suman). Si no, solo marca el origen y
   * deja los descuentos para cuando pague.
   */
  async aplicarDespues(empresaId: string, usuario: { email: string; clerkUserId: string }, codigo: string) {
    const hoy = fechaHoyAR();
    const resultado = await this.prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.findUnique({ where: { id: empresaId }, include: { cupon: { select: { codigo: true } } } });
      if (!empresa) throw new NotFoundException('Empresa no encontrada');
      if (empresa.cupon) throw new ConflictException(`Ya tenés aplicado el código ${empresa.cupon.codigo}.`);

      const v = await this.verificar(codigo, { ...usuario, empresaId, cuit: empresa.cuit }, empresaId, tx);
      if (!v.ok) throw new BadRequestException(v.mensaje);

      const sub = await tx.suscripcion.findFirst({ where: { empresaId }, orderBy: [{ fechaVencimiento: { sort: 'desc', nulls: 'last' } }] });
      const vence = sub?.fechaVencimiento?.toISOString().slice(0, 10) ?? null;
      const enPrueba = sub?.estado === 'periodo_prueba' && vence != null && hoy < vence;
      const alta = empresa.pruebaDesde?.toISOString().slice(0, 10) ?? empresa.createdAt.toISOString().slice(0, 10);
      const nuevoFin = v.mesGratis && enPrueba ? finDePrueba(alta, v.cupon.diasPrueba!) : null;
      const extiende = nuevoFin != null && vence != null && nuevoFin > vence;

      if (extiende) {
        await tx.suscripcion.update({ where: { id: sub!.id }, data: { fechaVencimiento: new Date(`${nuevoFin}T00:00:00Z`) } });
      }
      await tx.empresa.update({
        where: { id: empresaId },
        data: {
          camaraId: v.cupon.camaraId,
          cuponId: v.cupon.id,
          ...(extiende ? { pruebaDesde: new Date(`${alta}T00:00:00Z`), pruebaHasta: new Date(`${nuevoFin}T00:00:00Z`) } : {}),
        },
      });
      await this.registrarUso(tx, v.cupon.id, { ...usuario, empresaId, cuit: empresa.cuit }, extiende);

      const mensaje = extiende
        ? `Listo: tu prueba gratis ahora dura hasta el ${nuevoFin!.split('-').reverse().join('/')}${v.cupon.camaraNombre ? ` por venir de ${v.cupon.camaraNombre}` : ''}.`
        : (v.aviso ?? 'Listo: el código quedó registrado y vas a tener sus descuentos al pagar.');
      return { codigo: v.cupon.codigo, camara: v.cupon.camaraNombre, pruebaHasta: extiende ? nuevoFin : null, mensaje };
    });
    this.accesoCuenta.olvidar(empresaId);
    return resultado;
  }
}
