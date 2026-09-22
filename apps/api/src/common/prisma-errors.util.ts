import { Prisma } from '@prisma/client';

/** P2002 = violación de restricción única (@@unique/@unique en el schema). */
export function esViolacionUnica(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
