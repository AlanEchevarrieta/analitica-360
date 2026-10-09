// Arma la clave privada y el pedido de certificado (CSR) para la factura electrónica de ARCA.
//
// Uso (desde apps/api):
//   node scripts/arca-pedido-certificado.mjs --cuit 20123456786 --organizacion "Analitica 360" [--alias analitica360] [--carpeta <ruta>]
//
// Deja dos archivos en la carpeta (por defecto ~/Documents/Alan/ARCA, FUERA del repositorio):
//   - analitica360.csr  → se sube en ARCA (Administración de Certificados Digitales / WSASS en homologación)
//   - analitica360.key  → la clave privada: SECRETA, no se manda por email ni chat. Va en ARCA_CLAVE.
// El certificado que devuelve ARCA (.crt) va en ARCA_CERTIFICADO.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import forge from 'node-forge';

const arg = (nombre, defecto) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > -1 ? process.argv[i + 1] : defecto;
};
const cuit = (arg('cuit') ?? '').replace(/\D/g, '');
const organizacion = arg('organizacion', 'Analitica 360');
const alias = arg('alias', 'analitica360');
const carpeta = arg('carpeta', path.join(os.homedir(), 'Documents', 'Alan', 'ARCA'));
if (cuit.length !== 11) {
  console.error('Falta el CUIT: --cuit 20123456786 (11 dígitos)');
  process.exit(1);
}

const clave = path.join(carpeta, `${alias}.key`);
if (fs.existsSync(clave)) {
  console.error(`Ya existe ${clave}: no la piso (si se pierde la clave, el certificado no sirve). Usá otro --alias.`);
  process.exit(1);
}
fs.mkdirSync(carpeta, { recursive: true });
console.log('Generando la clave (unos segundos)…');
const claves = forge.pki.rsa.generateKeyPair(2048);
const csr = forge.pki.createCertificationRequest();
csr.publicKey = claves.publicKey;
csr.setSubject([
  { name: 'countryName', value: 'AR' },
  { name: 'organizationName', value: organizacion },
  { name: 'commonName', value: alias },
  { type: '2.5.4.5', value: `CUIT ${cuit}` },
]);
csr.sign(claves.privateKey, forge.md.sha256.create());
fs.writeFileSync(clave, forge.pki.privateKeyToPem(claves.privateKey), { mode: 0o600 });
fs.writeFileSync(path.join(carpeta, `${alias}.csr`), forge.pki.certificationRequestToPem(csr));
console.log(`Listo:\n  ${path.join(carpeta, `${alias}.csr`)}  → subilo en ARCA\n  ${clave}  → SECRETA, no la compartas`);
