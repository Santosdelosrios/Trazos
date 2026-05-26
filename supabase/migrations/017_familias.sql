-- ============================================================
-- Migración 017: Familias (grupos de hermanos / responsables compartidos)
--
-- Decisiones:
--  - Una familia tiene datos propios (responsable, teléfono, datos de pago).
--  - Un alumno puede o no pertenecer a una familia (familia_id NULL).
--  - Saldo de familia = derivado (suma de saldos de alumnos miembros).
--    No persistimos saldo en la tabla familias para mantener única
--    fuente de verdad en alumnos.saldo_actual (mantenido por triggers).
--  - Soft delete habilitado vía deleted_at + vistas familias_activas.
--  - Backward-compatible: alumnos existentes quedan con familia_id NULL.
-- ============================================================

-- 1. TABLA familias --------------------------------------------------

CREATE TABLE IF NOT EXISTS public.familias (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  maestra_id            uuid NOT NULL REFERENCES public.maestras(id) ON DELETE CASCADE,
  nombre                text NOT NULL,
  responsable_nombre    text,
  responsable_telefono  text,  -- formato E.164 normalizado en la app
  datos_pago_override   text,  -- si NULL, hereda de maestras.datos_pago
  notas                 text,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.familias IS
  'Agrupa hermanos / responsables comunes. El saldo se deriva de los alumnos miembros.';
COMMENT ON COLUMN public.familias.responsable_telefono IS
  'Formato E.164 sin signo +: 549XXXXXXXXXX. Normalizado por la app.';
COMMENT ON COLUMN public.familias.datos_pago_override IS
  'CBU/alias/link MP que pisa el global de maestras. NULL = usa el de maestras.';

CREATE INDEX IF NOT EXISTS idx_familias_maestra
  ON public.familias(maestra_id) WHERE deleted_at IS NULL;

-- updated_at automático
CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_familias_updated_at ON public.familias;
CREATE TRIGGER trg_familias_updated_at
  BEFORE UPDATE ON public.familias
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- RLS
ALTER TABLE public.familias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "familias_own_maestra" ON public.familias;
CREATE POLICY "familias_own_maestra" ON public.familias
  FOR ALL USING (maestra_id = auth.uid());

-- Vista familias_activas (oculta soft-deleted)
CREATE OR REPLACE VIEW public.familias_activas AS
  SELECT * FROM public.familias WHERE deleted_at IS NULL;

-- 2. ALTER alumnos: vínculo a familia + responsable individual --------

ALTER TABLE public.alumnos
  ADD COLUMN IF NOT EXISTS familia_id            uuid REFERENCES public.familias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsable_nombre    text,
  ADD COLUMN IF NOT EXISTS responsable_telefono  text;

COMMENT ON COLUMN public.alumnos.familia_id IS
  'NULL = alumno suelto. Si se asigna, hereda responsable/datos_pago de la familia salvo override.';
COMMENT ON COLUMN public.alumnos.responsable_telefono IS
  'Fallback cuando familia_id IS NULL. Formato E.164 normalizado.';

CREATE INDEX IF NOT EXISTS idx_alumnos_familia
  ON public.alumnos(familia_id) WHERE familia_id IS NOT NULL;

-- 3. RPC: saldos_por_familia(maestra_id) -----------------------------
--
-- Devuelve una fila por familia con saldo agregado (suma de saldo_actual
-- de los alumnos miembros, filtrando los modelos donde un saldo
-- positivo significa deuda monetaria — bolsa_creditos se excluye porque
-- ahí saldo positivo = créditos a favor del alumno, no deuda).
--
-- También devuelve:
--   - cant_alumnos: total de alumnos miembros (incluye todos los modelos)
--   - ultimo_pago: fecha del pago más reciente entre los miembros
--   - ultima_clase: fecha de la clase más reciente entre los miembros
--
-- La UI siempre debe poder expandir y mostrar saldo por alumno; este
-- RPC es solo agregación de cabecera.

CREATE OR REPLACE FUNCTION public.saldos_por_familia(p_maestra_id uuid)
RETURNS TABLE(
  familia_id           uuid,
  nombre               text,
  responsable_nombre   text,
  responsable_telefono text,
  cant_alumnos         bigint,
  saldo_total          numeric,
  ultimo_pago          date,
  ultima_clase         timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH miembros AS (
    SELECT a.id, a.familia_id, a.saldo_actual, a.modelo_cobro
      FROM public.alumnos a
     WHERE a.maestra_id = p_maestra_id
       AND a.familia_id IS NOT NULL
  ),
  saldos AS (
    SELECT
      m.familia_id,
      COUNT(*) AS cant_alumnos,
      COALESCE(SUM(
        CASE WHEN m.modelo_cobro IN ('por_clase','abono_mensual','cuenta_corriente')
             THEN m.saldo_actual
             ELSE 0
        END
      ), 0) AS saldo_total
    FROM miembros m
    GROUP BY m.familia_id
  ),
  ultimo_pago AS (
    SELECT a.familia_id, MAX(p.fecha_pago) AS fecha
      FROM public.pagos p
      JOIN public.alumnos a ON a.id = p.alumno_id
     WHERE p.maestra_id = p_maestra_id
       AND a.familia_id IS NOT NULL
       AND p.estado IN ('pagado','parcial')
     GROUP BY a.familia_id
  ),
  ultima_clase AS (
    SELECT a.familia_id, MAX(c.fecha) AS fecha
      FROM public.clases c
      JOIN public.clase_alumnos ca ON ca.clase_id = c.id
      JOIN public.alumnos a ON a.id = ca.alumno_id
     WHERE c.maestra_id = p_maestra_id
       AND a.familia_id IS NOT NULL
     GROUP BY a.familia_id
  )
  SELECT
    f.id,
    f.nombre,
    f.responsable_nombre,
    f.responsable_telefono,
    COALESCE(s.cant_alumnos, 0),
    COALESCE(s.saldo_total, 0),
    up.fecha,
    uc.fecha
  FROM public.familias f
  LEFT JOIN saldos       s  ON s.familia_id  = f.id
  LEFT JOIN ultimo_pago  up ON up.familia_id = f.id
  LEFT JOIN ultima_clase uc ON uc.familia_id = f.id
  WHERE f.maestra_id = p_maestra_id
    AND f.deleted_at IS NULL
  ORDER BY f.nombre;
$$;

REVOKE EXECUTE ON FUNCTION public.saldos_por_familia(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.saldos_por_familia(uuid) TO authenticated;

-- 4. RPC: detalle_familia(familia_id) --------------------------------
--
-- Devuelve los alumnos de una familia con su saldo y modelo de cobro,
-- listo para renderizar la expansión "desglose por hermano".

CREATE OR REPLACE FUNCTION public.detalle_familia(p_familia_id uuid)
RETURNS TABLE(
  alumno_id        uuid,
  nombre           text,
  apellido         text,
  modelo_cobro     modelo_cobro_enum,
  saldo_actual     numeric,
  tarifa_efectiva  numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    a.id,
    a.nombre,
    a.apellido,
    a.modelo_cobro,
    a.saldo_actual,
    COALESCE(
      a.tarifa_override,
      (SELECT t.valor_hora FROM public.tarifas t
        WHERE t.maestra_id = a.maestra_id AND t.activa = true
        ORDER BY t.vigente_desde DESC LIMIT 1),
      0
    )
  FROM public.alumnos a
  WHERE a.familia_id = p_familia_id
    AND a.maestra_id = auth.uid()
  ORDER BY a.nombre, a.apellido;
$$;

REVOKE EXECUTE ON FUNCTION public.detalle_familia(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.detalle_familia(uuid) TO authenticated;
