import { SetMetadata } from '@nestjs/common';

export const SIN_EMPRESA_KEY = 'sinEmpresa';

/**
 * El endpoint exige sesión de Clerk válida pero NO una empresa activa:
 * solo para el alta de una empresa nueva (registro propio).
 */
export const SinEmpresa = () => SetMetadata(SIN_EMPRESA_KEY, true);
