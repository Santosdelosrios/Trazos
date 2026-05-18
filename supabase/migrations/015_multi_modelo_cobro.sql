-- ============================================================
-- Migración 015: Multi-Modelo de Cobro
-- 100% retrocompatible: alumnos existentes → por_clase
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE modelo_cobro_enum AS ENUM (
    'por_clase',
    'bolsa_creditos',
    'abono_mensual',
    'cuenta_corriente'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_movimiento_enum AS ENUM (
    'pago_ingresado',
    'clase_descontada',
    'ajuste',
    'cargo_abono'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 2. ALTER: alumnos
-- ============================================================

ALTER TABLE public.alumnos
  ADD COLUMN IF NOT EXISTS modelo_cobro modelo_cobro_enum NOT NULL DEFAULT 'por_clase',
  ADD COLUMN IF NOT EXISTS tarifa_override numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS saldo_actual numeric(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.alumnos.modelo_cobro IS 'Modelo de facturación del alumno.';
COMMENT ON COLUMN public.alumnos.tarifa_override IS 'Tarifa individual. NULL = tarifa global de la maestra.';
COMMENT ON COLUMN public.alumnos.saldo_actual IS 'Saldo cacheado, actualizado por trigger. Semántica depende de modelo_cobro.';

-- ============================================================
-- 3. ALTER: pagos (agregar periodo)
-- ============================================================

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS periodo text DEFAULT NULL;

COMMENT ON COLUMN public.pagos.periodo IS 'Formato YYYY-MM. Para abonos mensuales y reportes.';

CREATE INDEX IF NOT EXISTS idx_pagos_periodo
  ON public.pagos(maestra_id, alumno_id, periodo);

-- ============================================================
-- 4. TABLA: abonos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.abonos (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  maestra_id      uuid NOT NULL REFERENCES public.maestras(id) ON DELETE CASCADE,
  alumno_id       uuid NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  monto_mensual   numeric(10,2) NOT NULL CHECK (monto_mensual > 0),
  activo          boolean NOT NULL DEFAULT true,
  vigente_desde   date NOT NULL DEFAULT CURRENT_DATE,
  notas           text,
  created_at      timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_abono_activo_alumno UNIQUE (alumno_id, activo)
);

CREATE INDEX IF NOT EXISTS idx_abonos_maestra ON public.abonos(maestra_id);
CREATE INDEX IF NOT EXISTS idx_abonos_alumno_activo ON public.abonos(alumno_id) WHERE activo = true;

ALTER TABLE public.abonos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "abonos_own_maestra" ON public.abonos
  FOR ALL USING (maestra_id = auth.uid());

-- ============================================================
-- 5. TABLA: movimientos_cuenta
-- ============================================================

CREATE TABLE IF NOT EXISTS public.movimientos_cuenta (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  maestra_id      uuid NOT NULL REFERENCES public.maestras(id) ON DELETE CASCADE,
  alumno_id       uuid NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  tipo_movimiento tipo_movimiento_enum NOT NULL,
  monto           numeric(10,2) NOT NULL DEFAULT 0,
  creditos        smallint NOT NULL DEFAULT 0,
  referencia_id   uuid DEFAULT NULL,
  descripcion     text,
  created_at      timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.movimientos_cuenta IS 'Libro contable por alumno para cuenta_corriente y bolsa_creditos.';
COMMENT ON COLUMN public.movimientos_cuenta.monto IS 'Valor monetario. Positivo=ingreso, negativo=cargo.';
COMMENT ON COLUMN public.movimientos_cuenta.creditos IS 'Cantidad de créditos. Positivo=compra, negativo=consumo. Solo para bolsa_creditos.';
COMMENT ON COLUMN public.movimientos_cuenta.referencia_id IS 'UUID de la entidad origen (pagos.id o clases.id). El tipo_movimiento indica la tabla.';

CREATE INDEX IF NOT EXISTS idx_mov_alumno ON public.movimientos_cuenta(alumno_id);
CREATE INDEX IF NOT EXISTS idx_mov_maestra ON public.movimientos_cuenta(maestra_id);
CREATE INDEX IF NOT EXISTS idx_mov_fecha ON public.movimientos_cuenta(alumno_id, created_at DESC);

ALTER TABLE public.movimientos_cuenta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movimientos_own_maestra" ON public.movimientos_cuenta
  FOR ALL USING (maestra_id = auth.uid());

-- ============================================================
-- 6. FUNCIÓN: recalcular_saldo (core)
-- Recalcula saldo_actual según modelo_cobro del alumno.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalcular_saldo(
  p_alumno_id uuid,
  p_maestra_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_modelo  modelo_cobro_enum;
  v_tarifa  numeric;
  v_saldo   numeric := 0;
BEGIN
  SELECT modelo_cobro INTO v_modelo
    FROM public.alumnos WHERE id = p_alumno_id;

  IF v_modelo IS NULL THEN RETURN 0; END IF;

  CASE v_modelo

    WHEN 'por_clase' THEN
      -- tarifa efectiva
      SELECT COALESCE(
        (SELECT tarifa_override FROM public.alumnos WHERE id = p_alumno_id),
        (SELECT valor_hora FROM public.tarifas
          WHERE maestra_id = p_maestra_id AND activa = true
          ORDER BY vigente_desde DESC LIMIT 1),
        0
      ) INTO v_tarifa;

      SELECT
        (COUNT(ca.*) * v_tarifa)
        - COALESCE(
            (SELECT SUM(p.monto) FROM public.pagos p
              WHERE p.alumno_id = p_alumno_id
                AND p.maestra_id = p_maestra_id
                AND p.estado IN ('pagado', 'parcial')),
            0)
        INTO v_saldo
      FROM public.clase_alumnos ca
      JOIN public.clases c ON c.id = ca.clase_id
      WHERE ca.alumno_id = p_alumno_id AND c.maestra_id = p_maestra_id;

    WHEN 'bolsa_creditos' THEN
      -- saldo = créditos restantes (positivo = tiene, negativo = pasado)
      SELECT COALESCE(SUM(creditos), 0) INTO v_saldo
        FROM public.movimientos_cuenta
       WHERE alumno_id = p_alumno_id AND maestra_id = p_maestra_id;

    WHEN 'abono_mensual' THEN
      -- deuda = meses_con_cargo × monto_mensual − pagos
      SELECT
        (COUNT(DISTINCT p.periodo)
          * COALESCE(
              (SELECT ab.monto_mensual FROM public.abonos ab
                WHERE ab.alumno_id = p_alumno_id AND ab.activo = true LIMIT 1),
              0))
        - COALESCE(SUM(CASE WHEN p.estado IN ('pagado','parcial') THEN p.monto ELSE 0 END), 0)
        INTO v_saldo
      FROM public.pagos p
      WHERE p.alumno_id = p_alumno_id
        AND p.maestra_id = p_maestra_id
        AND p.periodo IS NOT NULL;

    WHEN 'cuenta_corriente' THEN
      -- saldo negativo en movimientos = deuda → invertimos para UI
      SELECT COALESCE(SUM(monto), 0) * -1 INTO v_saldo
        FROM public.movimientos_cuenta
       WHERE alumno_id = p_alumno_id AND maestra_id = p_maestra_id;

  END CASE;

  -- Persistir
  UPDATE public.alumnos SET saldo_actual = COALESCE(v_saldo, 0)
   WHERE id = p_alumno_id;

  RETURN COALESCE(v_saldo, 0);
END;
$$;

-- ============================================================
-- 7. TRIGGER: auto-recalcular saldo_actual
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_recalcular_saldo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alumno_id  uuid;
  v_maestra_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'movimientos_cuenta' THEN
    v_alumno_id  := COALESCE(NEW.alumno_id, OLD.alumno_id);
    v_maestra_id := COALESCE(NEW.maestra_id, OLD.maestra_id);

  ELSIF TG_TABLE_NAME = 'pagos' THEN
    v_alumno_id  := COALESCE(NEW.alumno_id, OLD.alumno_id);
    v_maestra_id := COALESCE(NEW.maestra_id, OLD.maestra_id);

  ELSIF TG_TABLE_NAME = 'clase_alumnos' THEN
    v_alumno_id := COALESCE(NEW.alumno_id, OLD.alumno_id);
    SELECT c.maestra_id INTO v_maestra_id
      FROM public.clases c
     WHERE c.id = COALESCE(NEW.clase_id, OLD.clase_id);
  END IF;

  IF v_alumno_id IS NOT NULL AND v_maestra_id IS NOT NULL THEN
    PERFORM public.recalcular_saldo(v_alumno_id, v_maestra_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers en movimientos_cuenta
DROP TRIGGER IF EXISTS trg_mov_saldo ON public.movimientos_cuenta;
CREATE TRIGGER trg_mov_saldo
  AFTER INSERT OR UPDATE OR DELETE ON public.movimientos_cuenta
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_saldo();

-- Triggers en pagos
DROP TRIGGER IF EXISTS trg_pagos_saldo ON public.pagos;
CREATE TRIGGER trg_pagos_saldo
  AFTER INSERT OR UPDATE OR DELETE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_saldo();

-- Triggers en clase_alumnos (afecta por_clase)
DROP TRIGGER IF EXISTS trg_clase_alumnos_saldo ON public.clase_alumnos;
CREATE TRIGGER trg_clase_alumnos_saldo
  AFTER INSERT OR DELETE ON public.clase_alumnos
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_saldo();

-- ============================================================
-- 8. RPC: calcular_saldo_alumno (v2 polimórfica)
-- Mantiene la misma firma para no romper código existente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calcular_saldo_alumno(
  p_alumno_id uuid,
  p_maestra_id uuid
)
RETURNS TABLE(
  clases_dictadas bigint,
  total_facturado numeric,
  total_cobrado numeric,
  saldo_pendiente numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_modelo modelo_cobro_enum;
  v_clases bigint;
BEGIN
  SELECT modelo_cobro INTO v_modelo
    FROM public.alumnos WHERE id = p_alumno_id;

  -- Clases dictadas (siempre útil)
  SELECT COUNT(*) INTO v_clases
    FROM public.clase_alumnos ca
    JOIN public.clases c ON c.id = ca.clase_id
   WHERE ca.alumno_id = p_alumno_id AND c.maestra_id = p_maestra_id;

  -- Forzar recalculo del saldo cacheado
  PERFORM public.recalcular_saldo(p_alumno_id, p_maestra_id);

  CASE v_modelo

    WHEN 'por_clase' THEN
      RETURN QUERY
        SELECT v_clases,
          (SELECT saldo_actual + COALESCE(SUM(p.monto),0)
             FROM public.pagos p
            WHERE p.alumno_id = p_alumno_id AND p.maestra_id = p_maestra_id
              AND p.estado IN ('pagado','parcial')),
          COALESCE((SELECT SUM(p.monto) FROM public.pagos p
            WHERE p.alumno_id = p_alumno_id AND p.maestra_id = p_maestra_id
              AND p.estado IN ('pagado','parcial')), 0),
          (SELECT saldo_actual FROM public.alumnos WHERE id = p_alumno_id);

    WHEN 'bolsa_creditos' THEN
      RETURN QUERY
        SELECT v_clases,
          COALESCE((SELECT SUM(creditos) FROM public.movimientos_cuenta
            WHERE alumno_id = p_alumno_id AND maestra_id = p_maestra_id
              AND creditos > 0), 0)::numeric,
          v_clases::numeric,
          (SELECT saldo_actual FROM public.alumnos WHERE id = p_alumno_id);

    WHEN 'abono_mensual' THEN
      RETURN QUERY
        SELECT v_clases,
          (SELECT COUNT(DISTINCT periodo) *
            COALESCE((SELECT monto_mensual FROM public.abonos
              WHERE alumno_id = p_alumno_id AND activo = true LIMIT 1), 0)
            FROM public.pagos WHERE alumno_id = p_alumno_id
              AND maestra_id = p_maestra_id AND periodo IS NOT NULL),
          COALESCE((SELECT SUM(monto) FROM public.pagos
            WHERE alumno_id = p_alumno_id AND maestra_id = p_maestra_id
              AND estado IN ('pagado','parcial')), 0),
          (SELECT saldo_actual FROM public.alumnos WHERE id = p_alumno_id);

    WHEN 'cuenta_corriente' THEN
      RETURN QUERY
        SELECT v_clases,
          COALESCE((SELECT SUM(ABS(monto)) FROM public.movimientos_cuenta
            WHERE alumno_id = p_alumno_id AND maestra_id = p_maestra_id
              AND monto < 0), 0),
          COALESCE((SELECT SUM(monto) FROM public.movimientos_cuenta
            WHERE alumno_id = p_alumno_id AND maestra_id = p_maestra_id
              AND monto > 0), 0),
          (SELECT saldo_actual FROM public.alumnos WHERE id = p_alumno_id);

  END CASE;
END;
$$;

-- ============================================================
-- 9. RPC: calcular_saldos_maestra (v2 — usa saldo_actual cacheado)
-- Ahora simplemente lee el campo cacheado.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calcular_saldos_maestra(p_maestra_id uuid)
RETURNS TABLE(
  alumno_id uuid,
  saldo_pendiente numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT a.id AS alumno_id, a.saldo_actual AS saldo_pendiente
    FROM public.alumnos a
   WHERE a.maestra_id = p_maestra_id;
$$;

-- ============================================================
-- 10. PERMISOS
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.recalcular_saldo(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalcular_saldo(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recalcular_saldo(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.calcular_saldo_alumno(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calcular_saldo_alumno(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.calcular_saldo_alumno(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.calcular_saldos_maestra(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calcular_saldos_maestra(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.calcular_saldos_maestra(uuid) TO authenticated;

-- ============================================================
-- 11. Inicializar saldo_actual para alumnos existentes
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, maestra_id FROM public.alumnos LOOP
    PERFORM public.recalcular_saldo(r.id, r.maestra_id);
  END LOOP;
END;
$$;
