import forge from 'node-forge';
import { describe, expect, it } from 'vitest';
import { firmarCMS, generarPedidoCertificado } from './arca.firma.js';

/** Certificado autofirmado de prueba (el de verdad lo emite ARCA a partir del CSR). */
function certificadoDePrueba() {
  const claves = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = claves.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  const sujeto = [{ name: 'commonName', value: 'prueba' }];
  cert.setSubject(sujeto);
  cert.setIssuer(sujeto);
  cert.sign(claves.privateKey, forge.md.sha256.create());
  return { certPem: forge.pki.certificateToPem(cert), clavePem: forge.pki.privateKeyToPem(claves.privateKey) };
}

describe('firmarCMS', () => {
  it('arma un PKCS#7 firmado con el TRA adentro', () => {
    const { certPem, clavePem } = certificadoDePrueba();
    const cms = firmarCMS('<loginTicketRequest/>', certPem, clavePem);
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.decode64(cms))) as forge.pkcs7.PkcsSignedData & { rawCapture: { content: forge.asn1.Asn1 } };
    expect(p7.certificates).toHaveLength(1);
    expect(forge.asn1.toDer(p7.rawCapture.content).getBytes()).toContain('<loginTicketRequest/>');
  });
});

describe('generarPedidoCertificado', () => {
  it('genera la clave y un CSR con el CUIT', () => {
    const { clavePem, csrPem } = generarPedidoCertificado({ cuit: '20-12345678-6', organizacion: 'Analitica 360', alias: 'analitica360' });
    expect(clavePem).toContain('PRIVATE KEY');
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    expect(csr.verify()).toBe(true);
    expect(csr.subject.getField({ type: '2.5.4.5' }).value).toBe('CUIT 20123456786');
  });
}, 30_000);
