import { describe, expect, it } from 'vitest';
import * as compartido from '../../../../../packages/shared-types/src/planes.js';
import { PLANES } from './planes.util.js';

// La web usa packages/shared-types; la API, su propia copia (compila a JS y no
// puede importar el paquete). Si alguien cambia un plan en un lado y no en el
// otro, este test lo frena.
describe('planes: API y web dicen lo mismo', () => {
  it('mismas funciones y límites en cada plan', () => {
    expect(compartido.PLANES).toEqual(PLANES);
  });

  it('la prueba gratis es el mismo plan', async () => {
    const { PLAN_DE_PRUEBA } = await import('./planes.util.js');
    expect(compartido.PLAN_DE_PRUEBA).toBe(PLAN_DE_PRUEBA);
  });
});
