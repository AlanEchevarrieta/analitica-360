// DTOs y zod schemas compartidos entre apps/api y apps/web.
// Se puebla dominio por dominio en las Fases 4/5 del plan de reescritura
// (cada módulo NestJS exporta su DTO acá, y apps/web lo reusa para
// react-hook-form + validación de formularios).
export * from "./planes.js";
