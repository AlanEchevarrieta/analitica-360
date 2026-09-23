import { z } from 'zod';

/** El frontend parsea el .xlsx/.csv client-side (con `xlsx`/`papaparse`, como en el legacy) y manda la matriz cruda: primera fila = encabezados. */
export const importarProductosSchema = z.object({
  filas: z.array(z.array(z.union([z.string(), z.number(), z.null(), z.undefined()]))).max(5001, 'Máximo 5000 filas de datos por importación'),
});
export type ImportarProductosDto = z.infer<typeof importarProductosSchema>;
