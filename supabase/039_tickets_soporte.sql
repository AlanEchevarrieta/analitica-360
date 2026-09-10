-- Tickets de soporte (cliente + admin).
-- SQL Editor, rol postgres. Pegá TODO y dale Run.
-- RLS usa get_empresa_id() (usuarios.id = auth.uid(); no hay auth_id).

CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  usuario_id UUID REFERENCES public.usuarios(id),
  numero_ticket TEXT,
  asunto TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'consulta'
    CHECK (categoria IN ('consulta', 'bug', 'sugerencia', 'facturacion', 'otro')),
  prioridad TEXT NOT NULL DEFAULT 'media'
    CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
  estado TEXT NOT NULL DEFAULT 'abierto'
    CHECK (estado IN ('abierto', 'en_proceso', 'resuelto', 'cerrado')),
  visto_cliente_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS tickets_numero_ticket_uidx
  ON public.tickets (numero_ticket)
  WHERE numero_ticket IS NOT NULL;

CREATE INDEX IF NOT EXISTS tickets_empresa_estado_idx
  ON public.tickets (empresa_id, estado);

CREATE INDEX IF NOT EXISTS tickets_created_idx
  ON public.tickets (created_at DESC);

CREATE TABLE IF NOT EXISTS public.tickets_respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES public.usuarios(id),
  es_admin BOOLEAN NOT NULL DEFAULT FALSE,
  contenido TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tickets_respuestas_ticket_idx
  ON public.tickets_respuestas (ticket_id, created_at);

CREATE SEQUENCE IF NOT EXISTS public.tickets_numero_seq;

CREATE OR REPLACE FUNCTION public.formato_numero_ticket(p_n bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'T-' || lpad(p_n::text, GREATEST(6, length(p_n::text)), '0');
$$;

CREATE OR REPLACE FUNCTION public.asignar_numero_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  IF NEW.numero_ticket IS NOT NULL AND btrim(NEW.numero_ticket) <> '' THEN
    RETURN NEW;
  END IF;
  NEW.numero_ticket := public.formato_numero_ticket(nextval('public.tickets_numero_seq'));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_asignar_numero_ticket ON public.tickets;
CREATE TRIGGER trg_asignar_numero_ticket
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE PROCEDURE public.asignar_numero_ticket();

CREATE OR REPLACE FUNCTION public.tickets_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.empresa_id IS NULL THEN
      NEW.empresa_id := public.get_empresa_id();
    END IF;
    IF NOT public.es_admin_app() AND NEW.empresa_id IS DISTINCT FROM public.get_empresa_id() THEN
      RAISE EXCEPTION 'NO_AUTORIZADO';
    END IF;
    IF NEW.usuario_id IS NULL THEN
      NEW.usuario_id := auth.uid();
    END IF;
    RETURN NEW;
  END IF;

  NEW.updated_at := NOW();
  IF public.es_admin_app() THEN
    RETURN NEW;
  END IF;
  -- El cliente solo puede marcar el ticket como visto.
  NEW.empresa_id := OLD.empresa_id;
  NEW.usuario_id := OLD.usuario_id;
  NEW.numero_ticket := OLD.numero_ticket;
  NEW.asunto := OLD.asunto;
  NEW.descripcion := OLD.descripcion;
  NEW.categoria := OLD.categoria;
  NEW.prioridad := OLD.prioridad;
  NEW.estado := OLD.estado;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tickets_before_write ON public.tickets;
CREATE TRIGGER trg_tickets_before_write
  BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE PROCEDURE public.tickets_before_write();

CREATE OR REPLACE FUNCTION public.tickets_respuestas_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  IF NEW.autor_id IS NULL THEN
    NEW.autor_id := auth.uid();
  END IF;
  NEW.es_admin := public.es_admin_app();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tickets_respuestas_before_insert ON public.tickets_respuestas;
CREATE TRIGGER trg_tickets_respuestas_before_insert
  BEFORE INSERT ON public.tickets_respuestas
  FOR EACH ROW
  EXECUTE PROCEDURE public.tickets_respuestas_before_insert();

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets_respuestas ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.tickets TO authenticated;
GRANT SELECT, INSERT ON public.tickets_respuestas TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tickets_numero_seq TO authenticated;

DROP POLICY IF EXISTS empresa_propia ON public.tickets;
DROP POLICY IF EXISTS tickets_select ON public.tickets;
DROP POLICY IF EXISTS tickets_insert ON public.tickets;
DROP POLICY IF EXISTS tickets_update ON public.tickets;

CREATE POLICY tickets_select ON public.tickets
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id() OR public.es_admin_app());

CREATE POLICY tickets_insert ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY tickets_update ON public.tickets
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_empresa_id() OR public.es_admin_app())
  WITH CHECK (empresa_id = public.get_empresa_id() OR public.es_admin_app());

DROP POLICY IF EXISTS empresa_propia ON public.tickets_respuestas;
DROP POLICY IF EXISTS tickets_respuestas_select ON public.tickets_respuestas;
DROP POLICY IF EXISTS tickets_respuestas_insert ON public.tickets_respuestas;

CREATE POLICY tickets_respuestas_select ON public.tickets_respuestas
  FOR SELECT TO authenticated
  USING (
    public.es_admin_app()
    OR ticket_id IN (
      SELECT id FROM public.tickets WHERE empresa_id = public.get_empresa_id()
    )
  );

CREATE POLICY tickets_respuestas_insert ON public.tickets_respuestas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.es_admin_app()
    OR ticket_id IN (
      SELECT id FROM public.tickets
      WHERE empresa_id = public.get_empresa_id()
        AND estado <> 'cerrado'
    )
  );

CREATE OR REPLACE FUNCTION public.ficha_ticket(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_out jsonb;
BEGIN
  SELECT * INTO v_ticket FROM public.tickets WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF NOT public.es_admin_app() AND v_ticket.empresa_id IS DISTINCT FROM public.get_empresa_id() THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;

  SELECT jsonb_build_object(
    'id', t.id,
    'empresa_id', t.empresa_id,
    'usuario_id', t.usuario_id,
    'numero_ticket', t.numero_ticket,
    'asunto', t.asunto,
    'descripcion', t.descripcion,
    'categoria', t.categoria,
    'prioridad', t.prioridad,
    'estado', t.estado,
    'visto_cliente_at', t.visto_cliente_at,
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'empresa_nombre', e.nombre,
    'usuario_nombre', u.nombre,
    'usuario_email', u.email,
    'respuestas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'ticket_id', r.ticket_id,
        'autor_id', r.autor_id,
        'es_admin', r.es_admin,
        'contenido', r.contenido,
        'created_at', r.created_at
      ) ORDER BY r.created_at)
      FROM public.tickets_respuestas r
      WHERE r.ticket_id = t.id
    ), '[]'::jsonb)
  )
  INTO v_out
  FROM public.tickets t
  JOIN public.empresas e ON e.id = t.empresa_id
  LEFT JOIN public.usuarios u ON u.id = t.usuario_id
  WHERE t.id = p_id;

  RETURN v_out;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ficha_ticket(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_listar_tickets()
RETURNS TABLE (
  id uuid,
  empresa_id uuid,
  empresa_nombre text,
  numero_ticket text,
  asunto text,
  categoria text,
  prioridad text,
  estado text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  IF NOT public.es_admin_app() THEN
    RAISE EXCEPTION 'NO_AUTORIZADO';
  END IF;
  RETURN QUERY
  SELECT
    t.id,
    t.empresa_id,
    e.nombre,
    t.numero_ticket,
    t.asunto,
    t.categoria,
    t.prioridad,
    t.estado,
    t.created_at
  FROM public.tickets t
  JOIN public.empresas e ON e.id = t.empresa_id
  ORDER BY t.created_at DESC
  LIMIT 2000;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_listar_tickets() TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets_respuestas;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
