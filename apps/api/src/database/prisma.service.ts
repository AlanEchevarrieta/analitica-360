import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Conexión al Postgres de docker-compose.yml (DATABASE_URL en apps/api/.env).
// La configuración del CLI (migrate/db push) vive en prisma.config.ts.
// Prisma 7 requiere un driver adapter explícito en runtime - ya no basta con
// DATABASE_URL en el proceso (ver github.com/prisma/prisma driver adapters).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Conectado a Postgres');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
