-- La cadena seguía el orden del id, pero el id se asignaba antes de tomar el lock:
-- con dos pedidos a la vez, el de id menor podía encadenarse después que el de id mayor
-- y la verificación (que recorre por id) daba error. Ahora el id se toma con el lock
-- tomado, así el orden del id es el mismo que el de la cadena.
CREATE OR REPLACE FUNCTION registro_auditoria_encadenar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previo text;
BEGIN
  PERFORM pg_advisory_xact_lock(7036001);
  NEW.id := nextval(pg_get_serial_sequence('registro_auditoria', 'id'));
  SELECT hash INTO previo FROM registro_auditoria ORDER BY id DESC LIMIT 1;
  NEW.hash := encode(sha256(convert_to(coalesce(previo, 'genesis') || '|' || registro_auditoria_contenido(NEW), 'UTF8')), 'hex');
  RETURN NEW;
END $$;
