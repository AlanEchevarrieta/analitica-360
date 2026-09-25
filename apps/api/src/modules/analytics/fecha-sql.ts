import { Prisma } from '@prisma/client';

/**
 * Día local AR (date) de una columna timestamp SIN zona horaria. Prisma guarda
 * esas columnas en UTC, así que primero se marca como UTC y después se pasa a
 * hora de Mendoza. Con un solo `AT TIME ZONE 'America/...'` Postgres interpreta
 * el valor como si ya fuera hora local y corre el día hacia adelante: una venta
 * de las 21 h caía en el día siguiente.
 */
export function diaAR(columna: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`date(${columna} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Mendoza')`;
}
