import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation.js';

const obligatorias = {
  CLERK_SECRET_KEY: 'sk_test_x',
  INTERNAL_WEBHOOK_SECRET: 'secreto',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
};

describe('validateEnv', () => {
  it('toma las opcionales vacías como no configuradas (docker-compose las pasa como "")', () => {
    const env = validateEnv({ ...obligatorias, RESEND_API_KEY: '', TIENDA_PROXY_KEY: '', PORT: '', TIENDA_DOMINIO_BASE: '' });
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.TIENDA_PROXY_KEY).toBeUndefined();
    expect(env.PORT).toBe(3001);
    expect(env.TIENDA_DOMINIO_BASE).toBe('analitica360.app');
  });

  it('sigue exigiendo las obligatorias aunque vengan vacías', () => {
    expect(() => validateEnv({ ...obligatorias, CLERK_SECRET_KEY: '' })).toThrow(/CLERK_SECRET_KEY/);
  });
});
