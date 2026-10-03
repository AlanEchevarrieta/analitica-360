import { Prisma, type PrismaClient } from '@prisma/client';
import { contextoAuditoria, type EventoAuditoria } from './contexto-auditoria.js';
import { accionDeEdicion, aplicarData, AUDITADOS, diferencias, nombreDeFila, resumen, type Accion, type Fila } from './auditoria.util.js';

const ESCRITURAS = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany']);
/** Tope de filas por operación masiva (un "precios masivo" de 5000 productos no llena la bitácora). */
const TOPE_MASIVO = 300;

type Delegado = { findUnique: (a: unknown) => Promise<Fila | null>; findMany: (a: unknown) => Promise<Fila[]> };
const delegado = (base: PrismaClient, modelo: string) => (base as unknown as Record<string, Delegado>)[modelo[0].toLowerCase() + modelo.slice(1)];

/** El resultado de un create con include trae relaciones: quedan solo los campos de la fila. */
const sinRelaciones = (r: Fila, data: Fila): Fila =>
  Object.fromEntries(
    Object.entries({ ...data, ...r }).filter(([k, v]) => {
      const objeto = v !== null && typeof v === 'object' && !(v instanceof Date) && !('toNumber' in v);
      return !objeto || (k in r && k in data && !Object.keys(v as object).some((x) => ['connect', 'create', 'connectOrCreate', 'createMany'].includes(x)));
    }),
  );

const empresaDe = (modelo: string, fila: Fila | null): string | null => {
  if (!fila) return null;
  if (modelo === 'Empresa') return (fila.id as string) ?? null;
  return (fila.empresaId as string | undefined) ?? null;
};

/**
 * Registra en la bitácora cada escritura de las tablas auditadas que ocurre
 * dentro de un pedido HTTP (ver AuditoriaInterceptor). Lee la fila antes con
 * el cliente sin extender (`base`) para saber qué cambió.
 *
 * No ve lo que se escribe con SQL crudo ($executeRaw): esas rutas registran a mano si importa.
 */
export function extensionAuditoria(base: PrismaClient) {
  async function evento(modelo: string, accion: Accion, antes: Fila | null, despues: Fila | null): Promise<EventoAuditoria | null> {
    const conf = AUDITADOS[modelo];
    const fila = despues ?? antes;
    if (conf.filtro && fila && !conf.filtro(fila)) return null;
    const cambios = accion === 'borrar' && !despues ? diferencias(antes, null) : diferencias(antes, despues);
    if (accion === 'editar' && Object.keys(cambios).length === 0) return null;
    const final = accion === 'editar' ? accionDeEdicion(cambios) : accion === 'crear' && conf.accionAlCrear ? conf.accionAlCrear : accion;
    let nombre = nombreDeFila(modelo, fila);
    // La anulación apunta a la venta: se muestra su número.
    if (modelo === 'Anulacion' && fila?.ventaId) {
      const v = await base.venta.findUnique({ where: { id: fila.ventaId as string }, select: { numeroVenta: true } });
      nombre = v?.numeroVenta ?? nombre;
    }
    return {
      empresaId: empresaDe(modelo, fila),
      accion: final,
      entidad: modelo,
      entidadId: modelo === 'Anulacion' ? ((fila?.ventaId as string) ?? null) : ((fila?.id as string | undefined) ?? null),
      entidadNombre: nombre,
      resumen: resumen(modelo, final, nombre, cambios),
      cambios: Object.keys(cambios).length ? cambios : null,
    };
  }

  return Prisma.defineExtension({
    name: 'auditoria',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const ctx = contextoAuditoria();
          if (!ctx || !model || !AUDITADOS[model] || !ESCRITURAS.has(operation)) return query(args);
          const d = delegado(base, model);
          const a = args as { where?: unknown; data?: Fila | Fila[]; select?: Record<string, boolean> };
          const anotar = async (accion: Accion, antes: Fila | null, despues: Fila | null) => {
            const e = await evento(model, accion, antes, despues);
            if (e) ctx.eventos.push(e);
          };

          switch (operation) {
            case 'create': {
              const r = (await query(args)) as Fila;
              await anotar('crear', null, sinRelaciones(r, a.data as Fila));
              return r;
            }
            case 'createMany':
            case 'createManyAndReturn': {
              const r = await query(args);
              const filas = Array.isArray(r) ? (r as Fila[]) : ([] as Fila[]).concat((a.data as Fila | Fila[]) ?? []);
              for (const f of filas.slice(0, TOPE_MASIVO)) await anotar('crear', null, f);
              return r;
            }
            case 'update':
            case 'upsert': {
              const antes = await d.findUnique({ where: a.where });
              // Que el resultado traiga los campos que se cambian, aunque el select pida menos.
              if (a.select && a.data && !Array.isArray(a.data)) for (const k of Object.keys(a.data)) a.select[k] ??= true;
              const r = (await query(args)) as Fila;
              // Creada en esta misma transacción (todavía no se ve desde afuera): se actualiza el alta.
              const alta = !antes && r?.id ? ctx.eventos.findIndex((e) => e.entidad === model && e.entidadId === r.id && e.accion !== 'editar') : -1;
              if (alta >= 0) {
                const e = await evento(model, ctx.eventos[alta].accion, null, sinRelaciones(r, (a.data as Fila) ?? {}));
                if (e) ctx.eventos[alta] = e;
                return r;
              }
              await anotar(antes ? 'editar' : operation === 'upsert' ? 'crear' : 'editar', antes, sinRelaciones(r, (a.data as Fila) ?? {}));
              return r;
            }
            case 'updateMany':
            case 'updateManyAndReturn': {
              const antes = await d.findMany({ where: a.where, take: TOPE_MASIVO });
              const r = await query(args);
              for (const f of antes) await anotar('editar', f, aplicarData(f, a.data as Fila));
              return r;
            }
            case 'delete': {
              const antes = await d.findUnique({ where: a.where });
              const r = await query(args);
              await anotar('borrar', antes, null);
              return r;
            }
            case 'deleteMany': {
              const antes = await d.findMany({ where: a.where, take: TOPE_MASIVO });
              const r = await query(args);
              for (const f of antes) await anotar('borrar', f, null);
              return r;
            }
          }
          return query(args);
        },
      },
    },
  });
}
