import { diasHastaCumple } from './clientes.util.js';

describe('diasHastaCumple', () => {
  const hoy = new Date(2026, 8, 22); // 22 de septiembre de 2026

  it('devuelve 0 cuando el cumpleaños es hoy', () => {
    expect(diasHastaCumple('1990-09-22', hoy)).toBe(0);
  });

  it('devuelve los días restantes dentro del mismo año', () => {
    expect(diasHastaCumple('1990-09-29', hoy)).toBe(7);
  });

  it('salta al año siguiente cuando el cumpleaños ya pasó este año', () => {
    // 21/09 ya pasó -> recalcula contra el 21/09/2027 (364 días, sin 29/feb en el medio)
    expect(diasHastaCumple('1990-09-21', hoy)).toBe(364);
  });

  it('null cuando la fecha no tiene mes/día parseables', () => {
    expect(diasHastaCumple('no-es-fecha', hoy)).toBeNull();
  });
});
