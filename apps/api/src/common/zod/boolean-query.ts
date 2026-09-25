import { z } from 'zod';

/**
 * Booleano de query string. z.coerce.boolean() usa Boolean(valor), así que
 * "false" (un string no vacío) daba true: ?mostrarAnuladas=false mostraba
 * las anuladas. Acá solo "true"/"1" son verdaderos.
 */
export const booleanQuery = (porDefecto: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .default(porDefecto ? 'true' : 'false')
    .transform((v) => v === 'true' || v === '1');
