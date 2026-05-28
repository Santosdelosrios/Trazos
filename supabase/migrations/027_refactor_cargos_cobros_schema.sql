-- ============================================================
-- Migración 027: Refactor de finanzas — schema cargos/cobros
--
-- Crea las tablas nuevas (cargos, cobros, imputaciones) que van a
-- reemplazar el actual sistema de pagos + movimientos_cuenta. Esta
-- migración es 100% aditiva:
--   - No toca pagos, movimientos_cuenta, abonos, ni triggers vigentes.
--   - Las tablas nuevas arrancan vacías.
--   - alumnos.saldo_actual sigue siendo calculado por el sistema viejo.
--
-- El backfill de datos históricos y el swap del trigger de saldo van
-- en una migración separada (028_*) que se aplica cuando los números
-- ya estén validados en paralelo.
--
-- Modelo conceptual:
--   cargos  → lo que el alumno me debe (append-only, monto congelado)
--   cobros  → la plata que recibí          (append-only)
--   saldo   = Σ cargos − Σ cobros          (una fórmula, todos los modelos)
--   imputaciones → metadato de UI (qué cobro paga qué cargo)
-- ============================================================

-- 1. ENUMS ----------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE concepto_cargo_enum AS ENUM (
    'clase',           -- generado al cerrar una clase
    'abono_mensual',   -- materializado lazy al primer cierre del mes
    'pack',            -- ajuste/cargo manual por compra de pack (raro)
    'ajuste'           -- ajuste manual genérico (deuda, regalo, etc.)
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE cobro_origen_enum AS ENUM (
    'manual',          -- cargado a mano desde Cobranzas
    'pack',            -- pago de un pack pre-pagado (otorga créditos)
    'mercadopago',     -- vino desde el webhook MP (futuro)
    'importado'        -- migrado desde el sistema viejo
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. TABLA: cargos --------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cargos (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  maestra_id            uuid NOT NULL REFERENCES public.maestras(id) ON DELETE CASCADE,
  alumno_id             uuid NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  fecha                 date NOT NULL DEFAULT CURRENT_DATE,
  concepto              concepto_cargo_enum NOT NULL,
  monto                 numeric(10,2) NOT NULL CHECK (monto > 0),
  creditos_consumidos   smallint NOT NULL DEFAULT 0 CHECK (creditos_consumidos >= 0),
  clase_id              uuid REFERENCES public.clases(id) ON DELETE SET NULL,
  periodo               text,  -- 'YYYY-MM' cuando concepto = 'abono_mensual'
  descripcion           text,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Un alumno no puede tener dos cargos del mismo mes para el abono
  -- (la generación lazy depende de este UNIQUE para ser idempotente).
  CONSTRAINT uq_cargo_abono_periodo
    UNIQUE (alumno_id, concepto, periodo)
    DEFERRABLE INITIALLY IMMEDIATE,

  -- Validaciones de coherencia entre concepto y campos opcionales
  CONSTRAINT ck_cargo_clase_concepto
    CHECK (clase_id IS NULL OR concepto = 'clase'),
  CONSTRAINT ck_cargo_periodo_concepto
    CHECK (periodo IS NULL OR concepto = 'abono_mensual'),
  CONSTRAINT ck_cargo_periodo_formato
    CHECK (periodo IS NULL OR periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

COMMENT ON TABLE public.cargos IS
  'Cargos al alumno (append-only). monto se congela al momento de generar el cargo: si la maestra sube la tarifa, los cargos viejos no se recalculan.';
COMMENT ON COLUMN public.cargos.creditos_consumidos IS
  'Cantidad de clases que consume este cargo. Default 0 (no descuenta créditos). Se setea en 1 cuando se cierra una clase de un alumno con modelo pack.';
COMMENT ON COLUMN public.cargos.periodo IS
  'YYYY-MM. Obligatorio cuando concepto=abono_mensual, NULL en el resto.';

CREATE INDEX IF NOT EXISTS idx_cargos_alumno
  ON public.cargos(maestra_id, alumno_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cargos_clase
  ON public.cargos(clase_id) WHERE clase_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cargos_fecha
  ON public.cargos(maestra_id, fecha DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cargos_periodo
  ON public.cargos(maestra_id, periodo) WHERE periodo IS NOT NULL AND deleted_at IS NULL;

-- 3. TABLA: cobros --------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cobros (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  maestra_id            uuid NOT NULL REFERENCES public.maestras(id) ON DELETE CASCADE,
  alumno_id             uuid NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  fecha                 date NOT NULL DEFAULT CURRENT_DATE,
  monto                 numeric(10,2) NOT NULL CHECK (monto > 0),
  creditos_otorgados    smallint NOT NULL DEFAULT 0 CHECK (creditos_otorgados >= 0),
  medio_pago            medio_pago_enum,
  comprobante_url       text,
  nota                  text,
  origen                cobro_origen_enum NOT NULL DEFAULT 'manual',
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Solo los cobros de tipo 'pack' otorgan créditos. Si no es pack,
  -- creditos_otorgados debe ser 0.
  CONSTRAINT ck_cobro_creditos_solo_pack
    CHECK (origen = 'pack' OR creditos_otorgados = 0)
);

COMMENT ON TABLE public.cobros IS
  'Cobros recibidos (append-only). Para anular un cobro, soft-delete.';
COMMENT ON COLUMN public.cobros.creditos_otorgados IS
  'Cantidad de clases que otorga este cobro. Solo > 0 cuando origen=pack.';
COMMENT ON COLUMN public.cobros.origen IS
  'De dónde vino el cobro. importado = migrado desde pagos/movimientos_cuenta.';

CREATE INDEX IF NOT EXISTS idx_cobros_alumno
  ON public.cobros(maestra_id, alumno_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cobros_fecha
  ON public.cobros(maestra_id, fecha DESC) WHERE deleted_at IS NULL;

-- 4. TABLA: imputaciones -------------------------------------------
--
-- Junction M:N entre cobros y cargos. Es metadato puro para la UI
-- (qué clases tengo pagas). El cálculo de saldo NO la usa, así que
-- mantenerla desactualizada no rompe la contabilidad — solo afecta la
-- lista de "clases pendientes de imputar".

CREATE TABLE IF NOT EXISTS public.imputaciones (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cobro_id        uuid NOT NULL REFERENCES public.cobros(id) ON DELETE CASCADE,
  cargo_id        uuid NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  monto_imputado  numeric(10,2) NOT NULL CHECK (monto_imputado > 0),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Un cobro no puede imputarse dos veces al mismo cargo
  CONSTRAINT uq_imputacion_cobro_cargo UNIQUE (cobro_id, cargo_id)
);

CREATE INDEX IF NOT EXISTS idx_imputaciones_cobro ON public.imputaciones(cobro_id);
CREATE INDEX IF NOT EXISTS idx_imputaciones_cargo ON public.imputaciones(cargo_id);

COMMENT ON TABLE public.imputaciones IS
  'Trazabilidad UI: qué cobro paga qué cargo y por cuánto. NO participa del cálculo de saldo.';

-- 5. updated_at triggers (reusan trg_set_updated_at de 017) --------

DROP TRIGGER IF EXISTS trg_cargos_updated_at ON public.cargos;
CREATE TRIGGER trg_cargos_updated_at
  BEFORE UPDATE ON public.cargos
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_cobros_updated_at ON public.cobros;
CREATE TRIGGER trg_cobros_updated_at
  BEFORE UPDATE ON public.cobros
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- 6. RLS ------------------------------------------------------------

ALTER TABLE public.cargos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobros        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imputaciones  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cargos_own_maestra" ON public.cargos;
CREATE POLICY "cargos_own_maestra" ON public.cargos
  FOR ALL USING (maestra_id = auth.uid());

DROP POLICY IF EXISTS "cobros_own_maestra" ON public.cobros;
CREATE POLICY "cobros_own_maestra" ON public.cobros
  FOR ALL USING (maestra_id = auth.uid());

-- Imputaciones se filtran por la maestra dueña del cobro (que ya es
-- el filtro implícito de la RLS de cobros).
DROP POLICY IF EXISTS "imputaciones_own_maestra" ON public.imputaciones;
CREATE POLICY "imputaciones_own_maestra" ON public.imputaciones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.cobros c
       WHERE c.id = imputaciones.cobro_id
         AND c.maestra_id = auth.uid()
    )
  );

-- 7. VIEWS *_activos ------------------------------------------------

CREATE OR REPLACE VIEW public.cargos_activos AS
  SELECT * FROM public.cargos WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.cobros_activos AS
  SELECT * FROM public.cobros WHERE deleted_at IS NULL;

COMMENT ON VIEW public.cargos_activos IS
  'Cargos no eliminados. Las queries de listado deben usar esta vista.';
COMMENT ON VIEW public.cobros_activos IS
  'Cobros no eliminados. Las queries de listado deben usar esta vista.';

-- 8. RPC: saldo_alumno_v2 ------------------------------------------
--
-- Una sola fórmula para todos los modelos. Devuelve:
--   deuda                → cuánto me debe (positivo) o saldo a favor (negativo)
--   creditos_restantes   → clases del pack que aún no se consumieron
--                           (solo relevante para modelo pack; cero en el resto)
--
-- Convive con la función vieja calcular_saldo_alumno mientras dure
-- la transición. Se renombra a saldo_alumno() en la migración 028.

CREATE OR REPLACE FUNCTION public.saldo_alumno_v2(
  p_alumno_id uuid
)
RETURNS TABLE(
  deuda               numeric,
  creditos_restantes  int,
  total_cargado       numeric,
  total_cobrado       numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH t_cargos AS (
    SELECT
      COALESCE(SUM(monto), 0)               AS total_monto,
      COALESCE(SUM(creditos_consumidos), 0) AS total_creditos
    FROM public.cargos
    WHERE alumno_id = p_alumno_id AND deleted_at IS NULL
  ),
  t_cobros AS (
    SELECT
      COALESCE(SUM(monto), 0)              AS total_monto,
      COALESCE(SUM(creditos_otorgados), 0) AS total_creditos
    FROM public.cobros
    WHERE alumno_id = p_alumno_id AND deleted_at IS NULL
  )
  SELECT
    t_cargos.total_monto - t_cobros.total_monto                       AS deuda,
    (t_cobros.total_creditos - t_cargos.total_creditos)::int          AS creditos_restantes,
    t_cargos.total_monto                                              AS total_cargado,
    t_cobros.total_monto                                              AS total_cobrado
  FROM t_cargos, t_cobros;
$$;

COMMENT ON FUNCTION public.saldo_alumno_v2(uuid) IS
  'Saldo unificado: Σ cargos − Σ cobros. Sin CASE WHEN modelo. Convive con calcular_saldo_alumno hasta migración 028.';

REVOKE EXECUTE ON FUNCTION public.saldo_alumno_v2(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.saldo_alumno_v2(uuid) TO authenticated;

-- 9. RPC: clases_pendientes_imputacion_v2 --------------------------
--
-- Devuelve cargos de tipo 'clase' del alumno que aún no fueron
-- totalmente cubiertos por imputaciones. Reemplaza la versión de 019
-- que leía de pagos.

CREATE OR REPLACE FUNCTION public.clases_pendientes_imputacion_v2(
  p_alumno_id uuid
)
RETURNS TABLE(
  cargo_id        uuid,
  clase_id        uuid,
  fecha           date,
  descripcion     text,
  monto_total     numeric,
  monto_imputado  numeric,
  pendiente       numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH imputado AS (
    SELECT cargo_id, COALESCE(SUM(monto_imputado), 0) AS total
      FROM public.imputaciones
     GROUP BY cargo_id
  )
  SELECT
    c.id,
    c.clase_id,
    c.fecha,
    c.descripcion,
    c.monto,
    COALESCE(i.total, 0),
    GREATEST(c.monto - COALESCE(i.total, 0), 0)
  FROM public.cargos c
  LEFT JOIN imputado i ON i.cargo_id = c.id
  WHERE c.alumno_id = p_alumno_id
    AND c.maestra_id = auth.uid()
    AND c.concepto = 'clase'
    AND c.deleted_at IS NULL
    AND c.monto - COALESCE(i.total, 0) > 0
  ORDER BY c.fecha ASC;  -- FIFO
$$;

REVOKE EXECUTE ON FUNCTION public.clases_pendientes_imputacion_v2(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.clases_pendientes_imputacion_v2(uuid) TO authenticated;

-- ============================================================
-- Notas para la próxima migración (028):
--
--  - Backfill: pagos pendientes → cargos; pagos pagados/parciales →
--    cobros (+ cargo derivado si tienen clase_id); movimientos_cuenta
--    → split por signo; bolsa de créditos → cobros con
--    creditos_otorgados + cargos con creditos_consumidos.
--
--  - Migrar alumnos con modelo_cobro = 'cuenta_corriente' a 'por_clase'
--    (funcionalmente idénticos).
--
--  - Swap del trigger de saldo: drop trg_pagos_saldo, trg_mov_saldo;
--    crear trg_cargos_saldo y trg_cobros_saldo que llaman a una nueva
--    recalcular_saldo() = saldo_alumno_v2(...).deuda.
--
--  - Renombrar saldo_alumno_v2 → saldo_alumno, depreca
--    calcular_saldo_alumno (mantenerla 1 release retornando lo mismo).
--
--  - Drop progresivo de pagos, movimientos_cuenta, abonos (tabla),
--    pagos_activos, gastos_activos sigue. Mover monto_mensual y
--    tope_clases_mes a columnas en alumnos.
-- ============================================================
