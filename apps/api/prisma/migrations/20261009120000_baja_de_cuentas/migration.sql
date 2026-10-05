-- Baja de una cuenta completa a pedido del dueño (Ley 25.326): se pide, queda 30 días
-- bloqueada por si se arrepiente y después se borran los datos del negocio.
ALTER TABLE "empresas"
  ADD COLUMN "baja_solicitada_en" TIMESTAMP(3),
  ADD COLUMN "baja_programada_para" DATE,
  ADD COLUMN "baja_solicitada_por" VARCHAR(160),
  ADD COLUMN "baja_ejecutada_en" TIMESTAMP(3);

-- Bitácora: las filas de una cuenta borrada quedan con los datos personales tapados.
-- La cadena de hashes no se puede recalcular sobre una fila tapada, así que se guarda
-- cómo quedó (huella del contenido tapado) y el hash anterior con el que se encadenaba:
-- el verificador sigue detectando cualquier cambio, inserción o borrado.
CREATE TABLE "registro_auditoria_tachados" (
    "registro_id" BIGINT NOT NULL,
    "contenido_hash" VARCHAR(64) NOT NULL,
    "hash_previo" VARCHAR(64),
    "motivo" VARCHAR(200) NOT NULL,
    "tachado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_auditoria_tachados_pkey" PRIMARY KEY ("registro_id")
);

-- Tampoco se puede tocar el registro de lo tachado.
CREATE TRIGGER registro_auditoria_tachados_sin_cambios BEFORE UPDATE OR DELETE ON registro_auditoria_tachados FOR EACH ROW EXECUTE FUNCTION registro_auditoria_inalterable();
CREATE TRIGGER registro_auditoria_tachados_sin_truncate BEFORE TRUNCATE ON registro_auditoria_tachados FOR EACH STATEMENT EXECUTE FUNCTION registro_auditoria_inalterable();

-- La bitácora sigue sin poder modificarse ni borrarse. Única excepción: tapar datos
-- personales desde registro_auditoria_tachar() (sin tocar hash, fecha, empresa ni acción).
CREATE OR REPLACE FUNCTION registro_auditoria_inalterable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- IF anidados: PL/pgSQL no corta el AND a mitad de camino y en otras tablas NEW no tiene esas columnas.
  IF TG_TABLE_NAME = 'registro_auditoria' AND TG_OP = 'UPDATE' AND current_setting('auditoria.tachar', true) = 'on' THEN
    IF NEW.id = OLD.id AND NEW.hash = OLD.hash AND NEW.creado_en = OLD.creado_en
       AND NEW.empresa_id IS NOT DISTINCT FROM OLD.empresa_id AND NEW.actor_empresa_id IS NOT DISTINCT FROM OLD.actor_empresa_id
       AND NEW.actor_usuario_id IS NOT DISTINCT FROM OLD.actor_usuario_id AND NEW.actor_tipo = OLD.actor_tipo
       AND NEW.accion = OLD.accion AND NEW.entidad = OLD.entidad AND NEW.entidad_id IS NOT DISTINCT FROM OLD.entidad_id
    THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'La bitácora de auditoría no se puede modificar ni borrar';
END $$;

CREATE FUNCTION registro_auditoria_tachar(p_empresa uuid, p_motivo text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  -- Mismo lock que las inserciones: nadie se encadena mientras se tacha.
  PERFORM pg_advisory_xact_lock(7036001);
  CREATE TEMP TABLE _a_tachar ON COMMIT DROP AS
    -- coalesce: las filas sin empresa (null) no son de esta cuenta.
    SELECT r.id, lag(r.hash) OVER (ORDER BY r.id) AS previo, coalesce(r.empresa_id = p_empresa OR r.actor_empresa_id = p_empresa, false) AS es
    FROM registro_auditoria r;
  DELETE FROM _a_tachar a WHERE NOT a.es OR EXISTS (SELECT 1 FROM registro_auditoria_tachados t WHERE t.registro_id = a.id);
  PERFORM set_config('auditoria.tachar', 'on', true);
  UPDATE registro_auditoria r SET
    actor_nombre = '[borrado]',
    entidad_nombre = CASE WHEN r.entidad_nombre IS NULL THEN NULL ELSE '[borrado]' END,
    resumen = '[datos borrados a pedido del titular]',
    cambios = NULL,
    ip = NULL
  FROM _a_tachar a WHERE a.id = r.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('auditoria.tachar', 'off', true);
  INSERT INTO registro_auditoria_tachados (registro_id, contenido_hash, hash_previo, motivo)
    SELECT r.id, encode(sha256(convert_to(registro_auditoria_contenido(r), 'UTF8')), 'hex'), a.previo, p_motivo
    FROM registro_auditoria r JOIN _a_tachar a ON a.id = r.id;
  RETURN n;
END $$;

-- El hash que debería tener cada fila: el de la cadena, o (si se tachó) el guardado, solo si
-- la fila sigue como quedó al tacharla y se encadena con el mismo hash anterior.
CREATE FUNCTION registro_auditoria_esperado(r registro_auditoria, previo text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN t.registro_id IS NULL THEN encode(sha256(convert_to(coalesce(previo, 'genesis') || '|' || registro_auditoria_contenido(r), 'UTF8')), 'hex')
    WHEN t.contenido_hash = encode(sha256(convert_to(registro_auditoria_contenido(r), 'UTF8')), 'hex') AND t.hash_previo IS NOT DISTINCT FROM previo THEN r.hash
    ELSE 'tachado-alterado'
  END
  FROM (SELECT 1) uno LEFT JOIN registro_auditoria_tachados t ON t.registro_id = r.id
$$;
