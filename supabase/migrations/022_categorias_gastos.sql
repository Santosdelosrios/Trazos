-- ============================================================
-- Migración 022: PR-6 — Categorías de gasto editables por maestra
--
-- Estrategia expand → migrate → contract:
--   - Esta migración (expand): agrega tabla nueva + columna gastos.categoria_id
--     manteniendo el enum gastos.categoria legacy. Backfill 1-a-1.
--   - PR-N+1 (migrate): la app lee categoria_id, pero seguimos dual-write
--     en gastos.categoria con el nombre como fallback (no usado).
--   - PR-N+2 (contract): drop de gastos.categoria y categoria_gasto enum.
--
-- Backward-compat total: nada del código que solo conoce el enum se rompe.
-- ============================================================

-- 1. Tabla de categorías custom ------------------------------------

CREATE TABLE IF NOT EXISTS public.categorias_gasto_custom (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  maestra_id   uuid NOT NULL REFERENCES public.maestras(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  icono        text,                          -- nombre de lucide icon, ej "package"
  es_default   boolean NOT NULL DEFAULT false,-- las 5 que se siembran al onboarding
  /** Enum legacy al que mappea esta categoría (solo para las default).
      Permite mantener el dual-write con gastos.categoria. */
  enum_legacy  categoria_gasto,
  deleted_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (maestra_id, nombre)
);

COMMENT ON TABLE public.categorias_gasto_custom IS
  'Categorías de gasto editables por maestra. Reemplaza al enum categoria_gasto durante el rollout expand→migrate→contract.';

CREATE INDEX IF NOT EXISTS idx_cat_gasto_maestra
  ON public.categorias_gasto_custom(maestra_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_cat_gasto_updated_at ON public.categorias_gasto_custom;
CREATE TRIGGER trg_cat_gasto_updated_at
  BEFORE UPDATE ON public.categorias_gasto_custom
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

ALTER TABLE public.categorias_gasto_custom ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cat_gasto_own_maestra" ON public.categorias_gasto_custom;
CREATE POLICY "cat_gasto_own_maestra" ON public.categorias_gasto_custom
  FOR ALL USING (maestra_id = auth.uid());

-- Vista activa (consistencia con el resto del módulo)
CREATE OR REPLACE VIEW public.categorias_gasto_activas AS
  SELECT * FROM public.categorias_gasto_custom WHERE deleted_at IS NULL;

-- 2. FK en gastos --------------------------------------------------

ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS categoria_id uuid
    REFERENCES public.categorias_gasto_custom(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.gastos.categoria_id IS
  'Categoría custom asociada. La columna categoria (enum) queda durante el rollout para backward-compat; eventualmente se dropea.';

CREATE INDEX IF NOT EXISTS idx_gastos_categoria_id
  ON public.gastos(maestra_id, categoria_id) WHERE deleted_at IS NULL;

-- 3. Seeder per-maestra existente (5 defaults) --------------------
--
-- Las 5 default cubren los 4 valores del enum legacy + "Capacitación"
-- que no tenía equivalente. Por eso "Capacitación" arranca sin
-- enum_legacy: ningún gasto viejo se le asigna en el backfill.

INSERT INTO public.categorias_gasto_custom
       (maestra_id, nombre, icono, es_default, enum_legacy)
SELECT m.id, d.nombre, d.icono, true, d.enum_legacy
  FROM public.maestras m
 CROSS JOIN (VALUES
       ('Materiales',   'package',         'material'::categoria_gasto),
       ('Transporte',   'car',             'viatico'::categoria_gasto),
       ('Capacitación', 'graduation-cap',  NULL::categoria_gasto),
       ('Impuestos',    'receipt',         'impuesto'::categoria_gasto),
       ('Otros',        'more-horizontal', 'otro'::categoria_gasto)
     ) AS d(nombre, icono, enum_legacy)
 ON CONFLICT (maestra_id, nombre) DO NOTHING;

-- Maestras nuevas que se creen después de esta migración tienen su
-- seeder vía helper TS (ensureCategoriasDefault). Ver código TS.

-- 4. Backfill de gastos --------------------------------------------
-- Para cada gasto existente, asociamos la categoria_id correspondiente
-- a su categoria (enum) según el mapeo de las default. Lo hacemos
-- vía join por (maestra_id + enum_legacy).

UPDATE public.gastos g
   SET categoria_id = c.id
  FROM public.categorias_gasto_custom c
 WHERE c.maestra_id  = g.maestra_id
   AND c.enum_legacy = g.categoria
   AND c.es_default  = true
   AND c.deleted_at IS NULL
   AND g.categoria_id IS NULL;

-- 7. RPC: gastos por categoría del mes -----------------------------
-- Devuelve [{categoria_id, nombre, icono, total, cant}] para el dashboard.

CREATE OR REPLACE FUNCTION public.gastos_por_categoria_mes(
  p_maestra_id uuid,
  p_anio int DEFAULT EXTRACT(year FROM CURRENT_DATE)::int,
  p_mes  int DEFAULT EXTRACT(month FROM CURRENT_DATE)::int
)
RETURNS TABLE(
  categoria_id  uuid,
  nombre        text,
  icono         text,
  total         numeric,
  cant          bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH gastos_mes AS (
    SELECT g.*
      FROM public.gastos g
     WHERE g.maestra_id = p_maestra_id
       AND g.deleted_at IS NULL
       AND EXTRACT(year  FROM g.fecha) = p_anio
       AND EXTRACT(month FROM g.fecha) = p_mes
  )
  SELECT
    c.id          AS categoria_id,
    c.nombre      AS nombre,
    c.icono       AS icono,
    COALESCE(SUM(g.monto), 0) AS total,
    COUNT(g.id)               AS cant
  FROM public.categorias_gasto_custom c
  LEFT JOIN gastos_mes g ON g.categoria_id = c.id
  WHERE c.maestra_id = p_maestra_id
    AND c.deleted_at IS NULL
  GROUP BY c.id, c.nombre, c.icono
  HAVING COALESCE(SUM(g.monto), 0) > 0
  ORDER BY total DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.gastos_por_categoria_mes(uuid, int, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.gastos_por_categoria_mes(uuid, int, int) TO authenticated;
