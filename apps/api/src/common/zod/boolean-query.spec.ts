import { z } from 'zod';
import { booleanQuery } from './boolean-query.js';

describe('booleanQuery', () => {
  const schema = z.object({ flag: booleanQuery(false), activo: booleanQuery(true) });

  it('interpreta "false" como false (z.coerce.boolean lo leía como true)', () => {
    expect(schema.parse({ flag: 'false', activo: 'false' })).toEqual({ flag: false, activo: false });
  });

  it('acepta "true" y "1"', () => {
    expect(schema.parse({ flag: 'true', activo: '1' })).toEqual({ flag: true, activo: true });
  });

  it('usa el default si no viene', () => {
    expect(schema.parse({})).toEqual({ flag: false, activo: true });
  });

  it('rechaza valores que no son booleanos', () => {
    expect(schema.safeParse({ flag: 'si' }).success).toBe(false);
  });
});
