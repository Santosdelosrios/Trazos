-- ============================================================
-- Migración 035: backfill imputación de cargos bolsa_creditos
--                a cobros pack libres
--
-- Bug histórico: cuando se cerraba una clase de modelo bolsa_creditos,
-- se creaba un cargo concepto='clase' con creditos_consumidos=1 pero
-- NUNCA se imputaba al cobro origen='pack' del alumno. Resultado:
--
--   - El cargo aparecía como "pendiente" en Cobranzas
--   - El cobro del pack aparecía como "saldo a favor" lleno
--   - El saldo_actual del alumno bajaba (porque saldo = Σ cargos − Σ cobros)
--   - Pero los créditos sí se descontaban (creditos_actual)
--
-- Resultado UX: el alumno aparecía debiendo plata Y con saldo a favor
-- al mismo tiempo, lo cual era confuso.
--
-- Fix forward: cierreClase.ts ahora hace la imputación automática.
--
-- Fix backfill: este script recorre los cargos huérfanos (concepto='clase',
-- creditos_consumidos > 0, sin imputaciones, no soft-deleted) y los
-- imputa contra los cobros pack libres del mismo alumno, FIFO por fecha
-- del cobro.
-- ============================================================

DO $$
DECLARE
  v_cargo       RECORD;
  v_pack        RECORD;
  v_pendiente   numeric;
  v_disponible  numeric;
  v_a_imputar   numeric;
BEGIN
  -- Cargos huérfanos: concepto='clase' con créditos consumidos, sin
  -- imputaciones, activos.
  FOR v_cargo IN
    SELECT
      c.id,
      c.maestra_id,
      c.alumno_id,
      c.monto,
      c.fecha
    FROM public.cargos c
    LEFT JOIN public.imputaciones i ON i.cargo_id = c.id
    WHERE c.concepto = 'clase'
      AND c.creditos_consumidos > 0
      AND c.deleted_at IS NULL
      AND c.monto > 0
    GROUP BY c.id, c.maestra_id, c.alumno_id, c.monto, c.fecha
    HAVING COALESCE(SUM(i.monto_imputado), 0) < c.monto
    ORDER BY c.fecha ASC, c.created_at ASC
  LOOP
    -- Cuánto le falta cubrir.
    SELECT v_cargo.monto - COALESCE(SUM(i.monto_imputado), 0)
      INTO v_pendiente
      FROM public.imputaciones i
     WHERE i.cargo_id = v_cargo.id;

    IF v_pendiente <= 0 THEN
      CONTINUE;
    END IF;

    -- Iterar packs libres FIFO del alumno.
    FOR v_pack IN
      WITH imp_cobro AS (
        SELECT cobro_id, SUM(monto_imputado) AS total
          FROM public.imputaciones
         GROUP BY cobro_id
      )
      SELECT
        cb.id,
        cb.monto - COALESCE(ic.total, 0) AS libre
      FROM public.cobros cb
      LEFT JOIN imp_cobro ic ON ic.cobro_id = cb.id
      WHERE cb.maestra_id = v_cargo.maestra_id
        AND cb.alumno_id  = v_cargo.alumno_id
        AND cb.origen     = 'pack'
        AND cb.deleted_at IS NULL
        AND cb.monto - COALESCE(ic.total, 0) > 0
      ORDER BY cb.fecha ASC, cb.created_at ASC
    LOOP
      IF v_pendiente <= 0 THEN
        EXIT;
      END IF;

      v_disponible := v_pack.libre;
      v_a_imputar  := LEAST(v_disponible, v_pendiente);

      IF v_a_imputar > 0 THEN
        INSERT INTO public.imputaciones (cobro_id, cargo_id, monto_imputado)
          VALUES (v_pack.id, v_cargo.id, v_a_imputar);
        v_pendiente := v_pendiente - v_a_imputar;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- El trigger trg_recalcular_saldo_v2 sobre imputaciones NO existe (los
-- triggers están sobre cargos y cobros, no sobre imputaciones).
-- Por eso refrescamos saldos de los alumnos afectados manualmente.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT a.id
      FROM public.alumnos a
     WHERE a.modelo_cobro = 'bolsa_creditos'
  LOOP
    PERFORM public.recalcular_saldo(r.id);
  END LOOP;
END $$;
