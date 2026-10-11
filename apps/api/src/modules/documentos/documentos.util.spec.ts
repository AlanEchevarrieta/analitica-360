import { describe, expect, it } from 'vitest';
import { pdfDocumento } from './documento.pdf.js';
import { leerTokenDocumento, mensajeWhatsApp, nombreArchivo, nombrePago, numeroDocumento, telefonoWhatsApp, tokenDocumento } from './documentos.util.js';

describe('documentos', () => {
  it('numera con prefijo y 6 cifras', () => {
    expect(numeroDocumento('R', 12)).toBe('R-000012');
    expect(nombreArchivo('venta', 'V-000654')).toBe('comprobante-V-000654.pdf');
  });

  it('el link firmado se lee, vence y no se puede adulterar', () => {
    const t = tokenDocumento('secreto', 'emp', 'recibo', 'id1', '2026-12-10');
    expect(leerTokenDocumento('secreto', t, '2026-12-10')).toEqual({ empresaId: 'emp', tipo: 'recibo', id: 'id1' });
    expect(leerTokenDocumento('secreto', t, '2026-12-11')).toBeNull();
    expect(leerTokenDocumento('otro', t, '2026-10-11')).toBeNull();
    const [datos, firma] = t.split('.');
    const falso = Buffer.from(JSON.stringify(['otra', 'recibo', 'id1', '2026-12-10'])).toString('base64url');
    expect(leerTokenDocumento('secreto', `${falso}.${firma}`, '2026-10-11')).toBeNull();
    expect(datos).toBeTruthy();
  });

  it('arma el teléfono internacional para WhatsApp', () => {
    expect(telefonoWhatsApp('261 546-9432')).toBe('5492615469432');
    expect(telefonoWhatsApp('0261 5469432')).toBe('5492615469432');
    expect(telefonoWhatsApp('+54 9 261 546 9432')).toBe('5492615469432');
    expect(telefonoWhatsApp('54 261 5469432')).toBe('5492615469432');
    expect(telefonoWhatsApp('123')).toBeNull();
    expect(telefonoWhatsApp(null)).toBeNull();
  });

  it('el mensaje saluda por el nombre e incluye el link', () => {
    const m = mensajeWhatsApp({ tipo: 'presupuesto', numero: 'P-000003', cliente: 'Laura Pérez', negocio: 'Acacia Mates', total: '$ 46.800', url: 'https://x/y' });
    expect(m).toBe('Hola Laura! Te mandamos el presupuesto P-000003 por $ 46.800. Lo podés ver y descargar acá: https://x/y\nAcacia Mates');
  });

  it('nombra los medios de pago', () => {
    expect(nombrePago('qr')).toBe('Mercado Pago QR');
    expect(nombrePago('cuenta_corriente')).toBe('Cuenta corriente');
  });

  it('genera el PDF aunque tenga muchos renglones (pasa de página)', async () => {
    const pdf = await pdfDocumento({
      negocio: { nombre: 'Acacia Mates', cuit: '20123456789', direccion: 'San Martín 123, Guaymallén', telefono: '261 546 9432', email: 'hola@acacia.com', logo: null },
      titulo: 'Comprobante de venta',
      numero: 'V-000654',
      fecha: '2026-10-11',
      extras: [],
      cliente: { nombre: 'Laura Pérez', telefono: null, email: null },
      items: Array.from({ length: 70 }, (_, i) => ({ descripcion: `Mate imperial ${i + 1}`, cantidad: 1, precio: 25_000 })),
      resumen: [{ etiqueta: 'Subtotal', monto: 1_750_000 }],
      total: { etiqueta: 'Total', monto: 1_750_000 },
      detalles: ['Forma de pago: Efectivo'],
      notas: 'Gracias',
      pie: 'Gracias por tu compra',
      leyenda: 'Documento no válido como factura.',
      simbolo: '$',
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBe(3);
  });
});
