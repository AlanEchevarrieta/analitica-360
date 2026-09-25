import { z } from 'zod';

/** Fecha sin hora ("AAAA-MM-DD") que se guarda en una columna @db.Date. */
export const fechaSoloSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');

/**
 * Prisma espera un Date para las columnas @db.Date: pasarle el texto
 * "1990-09-27" tiraba "premature end of input" (no se podía cargar un
 * cliente con cumpleaños ni un lote con vencimiento).
 */
export function aFechaSolo(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const fecha = new Date(`${valor.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}
