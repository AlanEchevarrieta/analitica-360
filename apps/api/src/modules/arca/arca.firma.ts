import forge from 'node-forge';

/**
 * Firma el pedido de acceso (TRA) en formato CMS (PKCS#7 con el contenido adentro), como pide
 * el WSAA de ARCA, con el certificado y la clave privada de Analítica 360. Devuelve base64.
 */
export function firmarCMS(contenido: string, certificadoPem: string, clavePem: string): string {
  const certificado = forge.pki.certificateFromPem(certificadoPem);
  const clave = forge.pki.privateKeyFromPem(clavePem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(contenido, 'utf8');
  p7.addCertificate(certificado);
  p7.addSigner({
    key: clave,
    certificate: certificado,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

/**
 * Clave privada y pedido de certificado (CSR) para ARCA. El CSR se sube en "Administración de
 * Certificados Digitales" y ARCA devuelve el certificado. La clave queda guardada y es secreta.
 */
export function generarPedidoCertificado(datos: { cuit: string; organizacion: string; alias: string }): { clavePem: string; csrPem: string } {
  const claves = forge.pki.rsa.generateKeyPair(2048);
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = claves.publicKey;
  csr.setSubject([
    { name: 'countryName', value: 'AR' },
    { name: 'organizationName', value: datos.organizacion },
    { name: 'commonName', value: datos.alias },
    { type: '2.5.4.5', value: `CUIT ${datos.cuit.replace(/\D/g, '')}` }, // serialNumber
  ]);
  csr.sign(claves.privateKey, forge.md.sha256.create());
  return { clavePem: forge.pki.privateKeyToPem(claves.privateKey), csrPem: forge.pki.certificationRequestToPem(csr) };
}
