import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 ya no permite `datasource.url` dentro de schema.prisma — la
// conexión para el CLI (migrate/db push/studio) se configura acá. En
// runtime, PrismaClient sigue leyendo DATABASE_URL del proceso normalmente
// (ver src/database/prisma.service.ts).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
