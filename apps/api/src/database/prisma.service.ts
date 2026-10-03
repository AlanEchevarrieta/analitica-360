import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { extensionAuditoria } from '../common/auditoria/auditoria.extension.js';

// Conexión al Postgres de docker-compose.yml (DATABASE_URL en apps/api/.env).
// La configuración del CLI (migrate/db push) vive en prisma.config.ts.
// Prisma 7 requiere un driver adapter explícito en runtime - ya no basta con
// DATABASE_URL en el proceso (ver github.com/prisma/prisma driver adapters).
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // El adapter se arma acá y no a nivel de módulo: este archivo se importa
    // antes de que ConfigModule.forRoot() cargue apps/api/.env, y entonces
    // DATABASE_URL todavía era undefined (pg fallaba con "client password
    // must be a string" en la primera query).
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
    // Bitácora de auditoría: toda escritura de las tablas auditadas queda registrada
    // (ver common/auditoria). El cliente extendido conserva los métodos de esta clase.
    // Lee el "antes" con un pool propio y chico: si usara el mismo, con muchas
    // transacciones abiertas a la vez cada una esperaría una conexión que tienen
    // las otras y se trabarían (lo encontró el e2e de 20 cambios simultáneos).
    this.lectorAuditoria = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 4 }) });
    return this.$extends(extensionAuditoria(this.lectorAuditoria)) as unknown as PrismaService;
  }

  private readonly lectorAuditoria: PrismaClient;

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Conectado a Postgres');
  }

  async onModuleDestroy() {
    await Promise.all([this.$disconnect(), this.lectorAuditoria.$disconnect()]);
  }
}
