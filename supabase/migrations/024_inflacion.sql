-- ============================================================
-- Migración 024: PR-8 — Tabla de inflación mensual + RPC acumulada
--
-- Diseño:
--  - Tabla pública (read-only para usuarios autenticados, escritura
--    solo via SQL/admin). Sin RLS porque es información compartida.
--  - ipc_mensual se guarda como fracción decimal (0.0420 = 4.20%).
--  - mes es el primer día del mes (DATE) para mantener consistencia
--    y permitir cálculos de rango directos.
--
-- Datos:
--  - El seeder con valores históricos vive en 025_seed_inflacion.sql
--    para mantener separados schema y datos.
--  - Actualización mensual: ver supabase/migrations/INFLACION.md
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inflacion_mensual (
  mes          date PRIMARY KEY,
  ipc_mensual  numeric(6,4) NOT NULL CHECK (ipc_mensual >= -0.5 AND ipc_mensual <= 5.0),
  fuente       text NOT NULL DEFAULT 'INDEC',
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inflacion_mensual IS
  'Índice de inflación mensual oficial (default: INDEC IPC nacional). Una fila por mes. mes = primer día.';

COMMENT ON COLUMN public.inflacion_mensual.ipc_mensual IS
  'Variación porcentual mensual como fracción decimal. 0.0420 = 4.20%. Acepta negativo (deflación) y hasta 500%/mes como sanity check.';

-- Read open: cualquier usuario autenticado puede leer.
ALTER TABLE public.inflacion_mensual ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inflacion_read_authenticated" ON public.inflacion_mensual;
CREATE POLICY "inflacion_read_authenticated" ON public.inflacion_mensual
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- RPC: inflacion_acumulada(desde date)
--
-- Devuelve la inflación acumulada (como fracción decimal) desde el
-- primer día del mes de la fecha indicada (inclusive) hasta el mes
-- ACTUAL (exclusive del mes en curso, porque INDEC publica al cierre).
--
-- Ejemplo: si desde = '2024-01-15' → toma el mes 2024-01 inclusive
-- hasta el mes anterior al actual. Si la maestra cambió la tarifa
-- el 15 de enero, la fórmula incluye la inflación de enero completa.
--
-- Cálculo: producto compuesto de (1 + ipc) - 1.
--   inflación_acumulada = ∏(1 + ipc_mensual_i) - 1
--
-- Si no hay datos para algún mes intermedio, se IGNORA (se asume 0%
-- para no romper el cálculo). El frontend debería detectar gaps y
-- avisar.
-- ============================================================

CREATE OR REPLACE FUNCTION public.inflacion_acumulada(p_desde date)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    EXP(SUM(LN(1 + ipc_mensual))) - 1,
    0
  )
  FROM public.inflacion_mensual
  WHERE mes >= date_trunc('month', p_desde)
    AND mes < date_trunc('month', CURRENT_DATE);
$$;

REVOKE EXECUTE ON FUNCTION public.inflacion_acumulada(date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.inflacion_acumulada(date) TO authenticated;

-- ============================================================
-- RPC auxiliar: ultimo_mes_inflacion()
--
-- Devuelve el mes más reciente que tenemos en la tabla. Útil para que
-- la UI muestre "datos hasta MMM 'YY" y la maestra sepa si los datos
-- están al día.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ultimo_mes_inflacion()
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT MAX(mes) FROM public.inflacion_mensual;
$$;

REVOKE EXECUTE ON FUNCTION public.ultimo_mes_inflacion() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.ultimo_mes_inflacion() TO authenticated;
