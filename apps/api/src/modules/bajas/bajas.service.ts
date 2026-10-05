import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AlmacenArchivosService } from '../../common/archivos/almacen-archivos.service.js';
import { sinContextoAuditoria } from '../../common/auditoria/contexto-auditoria.js';
import { PrismaService } from '../../database/prisma.service.js';
import { fechaHoyAR } from '../analytics/analytics.util.js';
import { AccesoCuentaService } from '../planes/acceso-cuenta.service.js';
import { ClerkCuentasService } from '../registro/clerk-cuentas.service.js';
import { DIAS_PARA_ARREPENTIRSE, mismoNombre, ordenDeBorrado, sumarDias, TABLAS_QUE_SE_CONSERVAN, type Dependencia } from './bajas.util.js';

type Tx = Prisma.TransactionClient;
const fecha = (d: Date | null | undefined) => d?.toISOString().slice(0, 10) ?? null;

export interface EstadoBaja {
  /** null = no hay baja pedida. */
  programadaPara: string | null;
  solicitadaEn: string | null;
  solicitadaPor: string | null;
  diasRestantes: number | null;
}

@Injectable()
export class BajasService {
  private readonly logger = new Logger('Bajas');

  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: AccesoCuentaService,
    private readonly clerk: ClerkCuentasService,
    private readonly archivos: AlmacenArchivosService,
  ) {}

  async estado(empresaId: string): Promise<EstadoBaja> {
    const e = await this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { bajaProgramadaPara: true, bajaSolicitadaEn: true, bajaSolicitadaPor: true } });
    if (!e) throw new NotFoundException('Empresa no encontrada');
    const para = fecha(e.bajaProgramadaPara);
    const hoy = fechaHoyAR();
    return {
      programadaPara: para,
      solicitadaEn: e.bajaSolicitadaEn?.toISOString() ?? null,
      solicitadaPor: e.bajaSolicitadaPor,
      diasRestantes: para ? Math.max(0, Math.round((Date.parse(para) - Date.parse(hoy)) / 86_400_000)) : null,
    };
  }

  /** El dueño (o la consola) pide la baja: hay que escribir el nombre del negocio para confirmar. */
  async solicitar(empresaId: string, quien: string, confirmacion: string): Promise<EstadoBaja> {
    const e = await this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true, esDemo: true, bajaProgramadaPara: true, bajaEjecutadaEn: true } });
    if (!e || e.bajaEjecutadaEn) throw new NotFoundException('Empresa no encontrada');
    if (e.esDemo) throw new BadRequestException('Las cuentas de demostración no se borran.');
    if (!mismoNombre(confirmacion, e.nombre)) throw new BadRequestException(`Para confirmar, escribí el nombre del negocio tal cual: ${e.nombre}`);
    if (e.bajaProgramadaPara) throw new ConflictException('La baja ya está pedida.');
    await this.prisma.empresa.update({
      where: { id: empresaId },
      data: { bajaSolicitadaEn: new Date(), bajaSolicitadaPor: quien.slice(0, 160), bajaProgramadaPara: new Date(`${sumarDias(fechaHoyAR(), DIAS_PARA_ARREPENTIRSE)}T00:00:00Z`) },
    });
    this.acceso.olvidar(empresaId);
    return this.estado(empresaId);
  }

  async cancelar(empresaId: string): Promise<EstadoBaja> {
    const r = await this.prisma.empresa.updateMany({
      where: { id: empresaId, bajaEjecutadaEn: null, bajaProgramadaPara: { not: null } },
      data: { bajaSolicitadaEn: null, bajaSolicitadaPor: null, bajaProgramadaPara: null },
    });
    if (!r.count) throw new BadRequestException('No hay una baja pedida para cancelar.');
    this.acceso.olvidar(empresaId);
    return this.estado(empresaId);
  }

  /** Consola: las bajas pedidas y las ya hechas. */
  async listar() {
    const filas = await this.prisma.empresa.findMany({
      where: { OR: [{ bajaProgramadaPara: { not: null } }, { bajaEjecutadaEn: { not: null } }] },
      orderBy: [{ bajaProgramadaPara: 'asc' }],
      select: { id: true, nombre: true, bajaProgramadaPara: true, bajaSolicitadaEn: true, bajaSolicitadaPor: true, bajaEjecutadaEn: true },
    });
    return filas.map((f) => ({
      empresaId: f.id,
      nombre: f.nombre,
      programadaPara: fecha(f.bajaProgramadaPara),
      solicitadaEn: f.bajaSolicitadaEn?.toISOString() ?? null,
      solicitadaPor: f.bajaSolicitadaPor,
      ejecutadaEn: f.bajaEjecutadaEn?.toISOString() ?? null,
    }));
  }

  /** Las bajas que ya cumplieron su plazo (las ejecuta el programador). */
  async ejecutarVencidas(hoy = fechaHoyAR()): Promise<number> {
    const vencidas = await this.prisma.empresa.findMany({
      where: { bajaEjecutadaEn: null, bajaProgramadaPara: { lte: new Date(`${hoy}T00:00:00Z`) } },
      select: { id: true },
    });
    let n = 0;
    for (const { id } of vencidas) {
      try {
        await this.ejecutar(id);
        n++;
      } catch (e) {
        this.logger.error(`No se pudo borrar la cuenta ${id}: ${(e as Error).message}`);
      }
    }
    return n;
  }

  /**
   * Borra los datos del negocio. Quedan: nuestros cobros, la suscripción, la constancia de
   * los términos, los usos de cupones y la bitácora (con los datos personales tapados).
   * La empresa queda como "Cuenta borrada" (la referencian los pagos).
   */
  async ejecutar(empresaId: string): Promise<{ filasBorradas: number; bitacoraTachada: number }> {
    const empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { clerkOrgId: true, bajaEjecutadaEn: true, bajaSolicitadaEn: true } });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    if (empresa.bajaEjecutadaEn) throw new ConflictException('Esa cuenta ya fue borrada.');

    // Sin registro automático en la bitácora (ver sinContextoAuditoria): la baja deja su propia constancia.
    const resultado = await sinContextoAuditoria(() => this.prisma.$transaction(
      async (tx) => {
        const filasBorradas = await this.borrarDatos(tx, empresaId);
        // Su código de referido deja de funcionar (los pagos que lo usaron siguen apuntando a él).
        await tx.cupon.updateMany({ where: { tipo: 'referido', empresaReferenteId: empresaId }, data: { activo: false, descripcion: 'Recomendado por una cuenta borrada' } });
        await tx.empresa.update({
          where: { id: empresaId },
          data: {
            nombre: 'Cuenta borrada',
            rubro: null,
            telefono: null,
            origenRegistro: null,
            cuit: null,
            clerkOrgId: null,
            activo: false,
            deletedAt: new Date(),
            bajaEjecutadaEn: new Date(),
            bajaSolicitadaPor: null,
          },
        });
        const [{ n }] = await tx.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT registro_auditoria_tachar(${empresaId}::uuid, 'Baja de la cuenta a pedido del titular') AS n`);
        // Constancia (sin datos personales) de que la cuenta se borró.
        await tx.registroAuditoria.create({
          data: {
            empresaId,
            actorTipo: 'sistema',
            actorNombre: 'Sistema',
            accion: 'borrar',
            entidad: 'Empresa',
            entidadId: empresaId,
            resumen: `Se borraron los datos de la cuenta a pedido del titular (pedido el ${fecha(empresa.bajaSolicitadaEn) ?? 'sin fecha'}). Quedan los cobros y esta bitácora.`,
          },
        });
        return { filasBorradas, bitacoraTachada: Number(n) };
      },
      { timeout: 120_000 },
    ));

    // Fuera de la transacción: fotos y la organización de Clerk (si falla, queda en el log).
    await this.archivos.borrarEmpresa(empresaId).catch((e) => this.logger.warn(`Fotos de ${empresaId}: ${(e as Error).message}`));
    if (empresa.clerkOrgId) await this.clerk.borrarOrganizacion(empresa.clerkOrgId).catch((e) => this.logger.warn(`Clerk ${empresa.clerkOrgId}: ${(e as Error).message}`));
    this.acceso.olvidar(empresaId);
    this.logger.log(`Cuenta ${empresaId} borrada: ${resultado.filasBorradas} filas, ${resultado.bitacoraTachada} de bitácora tapadas`);
    return resultado;
  }

  /** Borra las filas de la empresa en todas las tablas que no se conservan, hijas primero. */
  private async borrarDatos(tx: Tx, empresaId: string): Promise<number> {
    const conEmpresa = (
      await tx.$queryRaw<{ tabla: string }[]>(Prisma.sql`
        SELECT c.table_name AS tabla FROM information_schema.columns c
        JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
        WHERE c.table_schema = 'public' AND c.column_name = 'empresa_id'`)
    )
      .map((f) => f.tabla)
      .filter((t) => !TABLAS_QUE_SE_CONSERVAN.has(t));
    const dependencias = await tx.$queryRaw<Dependencia[]>(Prisma.sql`
      SELECT hija.relname AS hija, ah.attname AS columna, madre.relname AS madre, am.attname AS "columnaMadre"
      FROM pg_constraint c
      JOIN pg_class hija ON hija.oid = c.conrelid
      JOIN pg_class madre ON madre.oid = c.confrelid
      JOIN pg_attribute ah ON ah.attrelid = c.conrelid AND ah.attnum = c.conkey[1]
      JOIN pg_attribute am ON am.attrelid = c.confrelid AND am.attnum = c.confkey[1]
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace AND array_length(c.conkey, 1) = 1`);

    // Tablas sin empresa_id que cuelgan de las que se borran (ítems, respuestas, sesiones…): se borran por su madre.
    const enEmpresa = new Set(conEmpresa);
    const colgadas = new Map<string, Dependencia[]>();
    for (const d of dependencias) {
      if (enEmpresa.has(d.madre) && !enEmpresa.has(d.hija) && !TABLAS_QUE_SE_CONSERVAN.has(d.hija) && d.hija !== 'empresas') {
        colgadas.set(d.hija, [...(colgadas.get(d.hija) ?? []), d]);
      }
    }

    // Lo que se conserva y apunta a algo que se borra: se suelta (columna en null).
    for (const d of dependencias) {
      if (TABLAS_QUE_SE_CONSERVAN.has(d.hija) && (enEmpresa.has(d.madre) || colgadas.has(d.madre))) {
        await tx.$executeRawUnsafe(
          `UPDATE "${d.hija}" SET "${d.columna}" = NULL WHERE "${d.columna}" IN (SELECT "${d.columnaMadre}" FROM "${d.madre}" WHERE ${colgadas.has(d.madre) ? condicionColgada(colgadas.get(d.madre)!) : 'empresa_id = $1::uuid'})`,
          empresaId,
        );
      }
    }

    let total = 0;
    for (const tabla of ordenDeBorrado([...conEmpresa, ...colgadas.keys()], dependencias)) {
      const condicion = colgadas.has(tabla) ? condicionColgada(colgadas.get(tabla)!) : 'empresa_id = $1::uuid';
      total += await tx.$executeRawUnsafe(`DELETE FROM "${tabla}" WHERE ${condicion}`, empresaId);
    }
    return total;
  }
}

/** Filas de una tabla sin empresa_id que apuntan a alguna fila de la empresa. Los nombres salen del catálogo de la base. */
function condicionColgada(madres: Dependencia[]): string {
  return madres.map((d) => `"${d.columna}" IN (SELECT "${d.columnaMadre}" FROM "${d.madre}" WHERE empresa_id = $1::uuid)`).join(' OR ');
}
