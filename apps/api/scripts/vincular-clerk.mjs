// Vincula una empresa migrada del legacy (y uno de sus usuarios) con Clerk.
//
// El webhook de Clerk (UsuariosModule) crea empresas NUEVAS por clerk_org_id;
// las empresas copiadas con migrar-desde-supabase.mjs no tienen clerk_org_id,
// así que sin este paso el usuario entraría a una empresa vacía.
//
// Uso (desde apps/api, con CLERK_SECRET_KEY y DATABASE_URL en .env):
//   node scripts/vincular-clerk.mjs --empresa <uuid> --email <email>
//
// Idempotente: reusa el usuario/organización de Clerk si ya existen.

import 'dotenv/config';
import pg from 'pg';

const arg = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const empresaId = arg('empresa');
const email = arg('email')?.toLowerCase();
const CLERK_KEY = process.env.CLERK_SECRET_KEY;
if (!empresaId || !email || !CLERK_KEY) {
  console.error('Uso: node scripts/vincular-clerk.mjs --empresa <uuid> --email <email>  (requiere CLERK_SECRET_KEY)');
  process.exit(1);
}

async function clerk(path, init = {}) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${CLERK_KEY}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Clerk ${path}: ${res.status} ${JSON.stringify(body?.errors ?? body)}`);
  return body;
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

try {
  const { rows: [empresa] } = await db.query('SELECT id, nombre, clerk_org_id FROM empresas WHERE id = $1', [empresaId]);
  if (!empresa) throw new Error(`No existe la empresa ${empresaId}`);
  const { rows: [usuario] } = await db.query(
    'SELECT id, rol FROM usuarios WHERE empresa_id = $1 AND lower(email) = $2',
    [empresaId, email],
  );
  if (!usuario) throw new Error(`${email} no es usuario de ${empresa.nombre}`);

  // 1. Usuario de Clerk (sin contraseña: entra con código por email o "olvidé mi contraseña").
  let [clerkUser] = await clerk(`/users?email_address=${encodeURIComponent(email)}`);
  if (!clerkUser) {
    clerkUser = await clerk('/users', {
      method: 'POST',
      body: JSON.stringify({ email_address: [email], skip_password_requirement: true }),
    });
    console.log(`Usuario de Clerk creado: ${clerkUser.id}`);
  } else {
    console.log(`Usuario de Clerk existente: ${clerkUser.id}`);
  }

  // 2. Organización de Clerk = empresa.
  let orgId = empresa.clerk_org_id;
  if (!orgId) {
    const org = await clerk('/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: empresa.nombre, created_by: clerkUser.id }),
    });
    orgId = org.id;
    console.log(`Organización de Clerk creada: ${orgId} (${empresa.nombre})`);
  }

  // 3. Membresía con el rol equivalente (created_by ya la hace admin).
  const rolClerk = usuario.rol === 'dueno' ? 'org:admin' : 'org:member';
  const miembros = await clerk(`/organizations/${orgId}/memberships?limit=100`);
  const actual = miembros.data.find((m) => m.public_user_data?.user_id === clerkUser.id);
  if (!actual) {
    await clerk(`/organizations/${orgId}/memberships`, {
      method: 'POST',
      body: JSON.stringify({ user_id: clerkUser.id, role: rolClerk }),
    });
  } else if (actual.role !== rolClerk) {
    await clerk(`/organizations/${orgId}/memberships/${clerkUser.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: rolClerk }),
    });
  }

  // 4. Guardar los ids de Clerk en la base.
  await db.query('UPDATE empresas SET clerk_org_id = $1 WHERE id = $2', [orgId, empresaId]);
  await db.query('UPDATE usuarios SET clerk_user_id = $1 WHERE id = $2', [clerkUser.id, usuario.id]);
  console.log(`Listo: ${email} entra a "${empresa.nombre}" como ${rolClerk}.`);
} finally {
  await db.end();
}
