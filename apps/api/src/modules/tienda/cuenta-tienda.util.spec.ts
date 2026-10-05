import { describe, expect, it } from 'vitest';
import { generarCodigo, generarToken, hashCodigo, hashToken, mismoHash, nombreDesdeEmail, normalizarEmail } from './cuenta-tienda.util.js';

describe('cuentas de la tienda', () => {
  it('el código tiene siempre 6 dígitos', () => {
    for (let i = 0; i < 200; i++) expect(generarCodigo()).toMatch(/^\d{6}$/);
  });

  it('el hash del código depende del secreto, la empresa y el email (sin importar mayúsculas)', () => {
    const h = hashCodigo('s', 'e1', 'Ana@X.com ', '123456');
    expect(h).toBe(hashCodigo('s', 'e1', 'ana@x.com', '123456'));
    expect(h).not.toBe(hashCodigo('otro', 'e1', 'ana@x.com', '123456'));
    expect(h).not.toBe(hashCodigo('s', 'e2', 'ana@x.com', '123456'));
    expect(h).not.toBe(hashCodigo('s', 'e1', 'ana@x.com', '123457'));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('comparación en tiempo constante', () => {
    expect(mismoHash('abc', 'abc')).toBe(true);
    expect(mismoHash('abc', 'abd')).toBe(false);
    expect(mismoHash('abc', 'abcd')).toBe(false);
  });

  it('tokens largos, distintos, y en la base solo el hash', () => {
    const a = generarToken();
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).not.toBe(generarToken());
    expect(hashToken(a)).not.toContain(a);
  });

  it('nombre inicial desde el email', () => {
    expect(nombreDesdeEmail('ana.perez99@gmail.com')).toBe('Ana Perez');
    expect(nombreDesdeEmail('1234@x.com')).toBe('Cliente de la tienda');
    expect(normalizarEmail(' Ana@X.COM ')).toBe('ana@x.com');
  });
});
