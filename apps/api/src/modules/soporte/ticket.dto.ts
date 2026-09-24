import { z } from 'zod';
import { CATEGORIAS_TICKET, ESTADOS_TICKET, PRIORIDADES_TICKET, type CategoriaTicket, type EstadoTicket, type PrioridadTicket } from './ticket.repository.js';

const categoriaValues = CATEGORIAS_TICKET as [CategoriaTicket, ...CategoriaTicket[]];
const prioridadValues = PRIORIDADES_TICKET as [PrioridadTicket, ...PrioridadTicket[]];
const estadoValues = ESTADOS_TICKET as [EstadoTicket, ...EstadoTicket[]];

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

export const cambiarEstadoTicketSchema = z.object({
  estado: z.enum(estadoValues),
});
export type CambiarEstadoTicketDto = z.infer<typeof cambiarEstadoTicketSchema>;
