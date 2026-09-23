import { z } from 'zod';
import { CATEGORIAS_TICKET, PRIORIDADES_TICKET, type CategoriaTicket, type PrioridadTicket } from './ticket.repository.js';

const categoriaValues = CATEGORIAS_TICKET as [CategoriaTicket, ...CategoriaTicket[]];
const prioridadValues = PRIORIDADES_TICKET as [PrioridadTicket, ...PrioridadTicket[]];

export const crearTicketSchema = z.object({
  asunto: z.string().trim().min(1, 'El asunto es obligatorio.'),
  descripcion: z.string().trim().min(20, 'La descripción debe tener al menos 20 caracteres.'),
  categoria: z.enum(categoriaValues).default('consulta'),
  prioridad: z.enum(prioridadValues).default('media'),
});
export type CrearTicketDto = z.infer<typeof crearTicketSchema>;

export const responderTicketSchema = z.object({
  contenido: z.string().trim().min(1, 'Escribí una respuesta.'),
});
export type ResponderTicketDto = z.infer<typeof responderTicketSchema>;
