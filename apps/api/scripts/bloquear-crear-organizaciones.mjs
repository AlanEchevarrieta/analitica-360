// Quita "crear organizaciones" en Clerk a los usuarios existentes: un negocio
// nuevo se crea solo con el registro (prueba de 14 días). Los usuarios nuevos ya
// salen bloqueados (registro e invitaciones); esto corrige los anteriores.
// No afecta el panel de Clerk ni la creación desde el servidor.
//
// Uso (desde apps/api, toma CLERK_SECRET_KEY de .env):
//   node scripts/bloquear-crear-organizaciones.mjs [--aplicar]

import 'dotenv/config';
import { createClerkClient } from '@clerk/backend';

const APLICAR = process.argv.includes('--aplicar');
if (!process.env.CLERK_SECRET_KEY) {
  console.error('Falta CLERK_SECRET_KEY');
  process.exit(1);
}
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const usuarios = [];
for (let offset = 0; ; offset += 100) {
  const { data } = await clerk.users.getUserList({ limit: 100, offset });
  usuarios.push(...data);
  if (data.length < 100) break;
}

const email = (u) => u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ?? u.id;
const habilitados = usuarios.filter((u) => u.createOrganizationEnabled);
console.log(`Usuarios en Clerk: ${usuarios.length} · pueden crear organizaciones: ${habilitados.length}`);
for (const u of habilitados) console.log(`  ${email(u)}`);

if (!APLICAR) {
  console.log('Modo prueba: no se cambió nada. Agregá --aplicar para bloquearlos.');
} else {
  for (const u of habilitados) {
    await clerk.users.updateUser(u.id, { createOrganizationEnabled: false });
    console.log(`  bloqueado: ${email(u)}`);
  }
  console.log(`Listo: ${habilitados.length} usuario(s) ya no pueden crear organizaciones desde Clerk.`);
}
