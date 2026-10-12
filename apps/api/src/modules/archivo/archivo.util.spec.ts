import { describe, expect, it } from 'vitest';
import { avisoQueToca, estadoVencimiento, nombreSeguro, tipoDeArchivo } from './archivo.util.js';

describe('archivo de documentos', () => {
  it('reconoce el tipo por el contenido, no por la extensión', () => {
    expect(tipoDeArchivo(Buffer.from('%PDF-1.7 ...'), 'factura.pdf')).toEqual({ extension: 'pdf', mime: 'application/pdf' });
    expect(tipoDeArchivo(Buffer.from('%PDF-1.7 ...'), 'factura.jpg')?.extension).toBe('pdf');
    expect(tipoDeArchivo(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'foto.png')?.extension).toBe('jpg');
    expect(tipoDeArchivo(Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'contrato.docx')?.extension).toBe('docx');
    expect(tipoDeArchivo(Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'virus.zip')).toBeNull();
    expect(tipoDeArchivo(Buffer.from('MZ\x90\x00'), 'programa.pdf')).toBeNull();
    expect(tipoDeArchivo(Buffer.from('<html><script>'), 'pagina.html')).toBeNull();
  });

  it('avisa a los 30 días y a los 7, una sola vez cada uno', () => {
    expect(avisoQueToca('2026-11-10', '2026-10-11', false, false)).toBe('30');
    expect(avisoQueToca('2026-11-10', '2026-10-11', true, false)).toBeNull();
    expect(avisoQueToca('2026-11-11', '2026-10-11', false, false)).toBeNull();
    expect(avisoQueToca('2026-10-18', '2026-10-11', true, false)).toBe('7');
    expect(avisoQueToca('2026-10-11', '2026-10-11', false, false)).toBe('7');
    expect(avisoQueToca('2026-10-15', '2026-10-11', false, true)).toBeNull();
    expect(avisoQueToca('2026-10-10', '2026-10-11', false, false)).toBeNull();
    expect(avisoQueToca(null, '2026-10-11', false, false)).toBeNull();
  });

  it('estado del vencimiento', () => {
    expect(estadoVencimiento('2026-10-10', '2026-10-11')).toBe('vencido');
    expect(estadoVencimiento('2026-11-10', '2026-10-11')).toBe('por_vencer');
    expect(estadoVencimiento('2026-12-31', '2026-10-11')).toBe('vigente');
  });

  it('el nombre de descarga no rompe el header', () => {
    expect(nombreSeguro('Contrato "alquiler"\r\n.pdf')).toBe('Contrato _alquiler___.pdf');
  });
});
