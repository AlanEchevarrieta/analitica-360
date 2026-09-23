import { Module } from '@nestjs/common';
import { TicketController } from './ticket.controller.js';
import { TicketService } from './ticket.service.js';
import { TICKET_REPOSITORY } from './ticket.repository.js';
import { PrismaTicketRepository } from './prisma-ticket.repository.js';

@Module({
  controllers: [TicketController],
  providers: [TicketService, { provide: TICKET_REPOSITORY, useClass: PrismaTicketRepository }],
})
export class SoporteModule {}
