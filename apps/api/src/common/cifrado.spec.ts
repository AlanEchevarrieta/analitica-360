import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cifrar, descifrar } from './cifrado.js';

const CLAVE = randomBytes(32).toString('base64');

describe('cifrado', () => {
  it('ida y vuelta, y cada vez sale distinto', () => {
    const a = cifrar('{"token":"abc","secreto":"xyz"}', CLAVE);
    expect(a).not.toContain('xyz');
    expect(a).not.toBe(cifrar('{"token":"abc","secreto":"xyz"}', CLAVE));
    expect(descifrar(a, CLAVE)).toBe('{"token":"abc","secreto":"xyz"}');
  });

  it('con otra clave o adulterado, falla', () => {
    const a = cifrar('secreto', CLAVE);
    expect(() => descifrar(a, randomBytes(32).toString('base64'))).toThrow();
    const partes = a.split('.');
    partes[3] = Buffer.from('otra cosa').toString('base64url');
    expect(() => descifrar(partes.join('.'), CLAVE)).toThrow();
  });

  it('la clave tiene que ser de 32 bytes', () => {
    expect(() => cifrar('x', Buffer.from('corta').toString('base64'))).toThrow('32 bytes');
  });
});
