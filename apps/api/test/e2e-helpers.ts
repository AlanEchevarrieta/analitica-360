import type pg from 'pg';

/** Suscripción activa con plan (por defecto E-commerce, que incluye todo): sin plan, la empresa queda en Starter. */
export async function suscripcionActiva(db: pg.Client, empresaId: string, plan: 'basico' | 'pro' | 'ecommerce' = 'ecommerce', estado = 'activa', vence = '2099-01-01') {
  await db.query(`INSERT INTO planes (id, nombre) SELECT gen_random_uuid(), $1 WHERE NOT EXISTS (SELECT 1 FROM planes WHERE nombre = $1)`, [plan]);
  await db.query(
    `INSERT INTO suscripciones (id, empresa_id, plan_id, estado, fecha_vencimiento) VALUES (gen_random_uuid(), $1, (SELECT id FROM planes WHERE nombre = $2 ORDER BY created_at LIMIT 1), $3, $4)`,
    [empresaId, plan, estado, vence],
  );
}
