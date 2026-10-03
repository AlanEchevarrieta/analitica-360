-- CreateTable
CREATE TABLE "registro_auditoria" (
    "id" BIGSERIAL NOT NULL,
    "empresa_id" UUID,
    "actor_usuario_id" UUID,
    "actor_empresa_id" UUID,
    "actor_tipo" VARCHAR(10) NOT NULL,
    "actor_nombre" VARCHAR(160) NOT NULL,
    "accion" VARCHAR(12) NOT NULL,
    "entidad" VARCHAR(40) NOT NULL,
    "entidad_id" VARCHAR(64),
    "entidad_nombre" VARCHAR(160),
    "resumen" TEXT NOT NULL,
    "cambios" JSONB,
    "ip" VARCHAR(64),
    "ruta" VARCHAR(200),
    "hash" VARCHAR(64) NOT NULL DEFAULT '',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registro_auditoria_empresa_id_creado_en_idx" ON "registro_auditoria"("empresa_id", "creado_en");

-- CreateIndex
CREATE INDEX "registro_auditoria_entidad_entidad_id_idx" ON "registro_auditoria"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "registro_auditoria_actor_usuario_id_creado_en_idx" ON "registro_auditoria"("actor_usuario_id", "creado_en");

-- CreateIndex
CREATE INDEX "registro_auditoria_creado_en_idx" ON "registro_auditoria"("creado_en");


-- Contenido que entra en el hash (en UTC, para que no dependa de la zona horaria de la sesión).
CREATE FUNCTION registro_auditoria_contenido(r registro_auditoria) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT concat_ws('|', r.id, r.empresa_id, r.actor_usuario_id, r.actor_empresa_id, r.actor_tipo, r.actor_nombre, r.accion,
    r.entidad, r.entidad_id, r.entidad_nombre, r.resumen, r.cambios::text, r.ip, r.ruta, to_char(r.creado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS'))
$$;

-- Cadena de hashes: cada fila incluye el hash de la anterior. Se serializa con un lock
-- (solo entre inserciones en la bitácora, que son cortas y se hacen después de cada pedido).
CREATE FUNCTION registro_auditoria_encadenar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previo text;
BEGIN
  PERFORM pg_advisory_xact_lock(7036001);
  SELECT hash INTO previo FROM registro_auditoria ORDER BY id DESC LIMIT 1;
  NEW.hash := encode(sha256(convert_to(coalesce(previo, 'genesis') || '|' || registro_auditoria_contenido(NEW), 'UTF8')), 'hex');
  RETURN NEW;
END $$;
CREATE TRIGGER registro_auditoria_encadenar BEFORE INSERT ON registro_auditoria FOR EACH ROW EXECUTE FUNCTION registro_auditoria_encadenar();

-- Inalterable: nadie la edita ni la borra (ni siquiera la app).
CREATE FUNCTION registro_auditoria_inalterable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de auditoría no se puede modificar ni borrar';
END $$;
CREATE TRIGGER registro_auditoria_sin_cambios BEFORE UPDATE OR DELETE ON registro_auditoria FOR EACH ROW EXECUTE FUNCTION registro_auditoria_inalterable();
CREATE TRIGGER registro_auditoria_sin_truncate BEFORE TRUNCATE ON registro_auditoria FOR EACH STATEMENT EXECUTE FUNCTION registro_auditoria_inalterable();
