-- ============================================================
-- Migración 005: Módulo Financiero y Operativo
-- Tablas: tarifas, gastos, pagos
-- ============================================================

-- Enum para categorías de gasto
DO $$ BEGIN
  CREATE TYPE categoria_gasto AS ENUM (
    'viatico', 'material', 'plataforma', 'impuesto', 'otro'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Enum para estado de pago
DO $$ BEGIN
  CREATE TYPE estado_pago AS ENUM ('pendiente', 'pagado', 'parcial', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- TABLA: tarifas
-- Valor hora histórico por maestra (permite cambiar sin perder datos)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tarifas (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  maestra_id    uuid NOT NULL REFERENCES public.maestras(id) ON DELETE CASCADE,
  valor_hora    numeric(10,2) NOT NULL CHECK (valor_hora > 0),
  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
  activa        boolean NOT NULL DEFAULT true,
  notas         text,
  created_at    timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.tarifas IS 'Historial de tarifas por hora de cada maestra. Solo una debería estar activa a la vez.';

CREATE INDEX IF NOT EXISTS idx_tarifas_maestra ON public.tarifas(maestra_id);
CREATE INDEX IF NOT EXISTS idx_tarifas_activa ON public.tarifas(maestra_id, activa) WHERE activa = true;

-- ============================================================
-- TABLA: gastos
-- Registro de costos operativos (viáticos, materiales, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gastos (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  maestra_id    uuid NOT NULL REFERENCES public.maestras(id) ON DELETE CASCADE,
  categoria     categoria_gasto NOT NULL,
  descripcion   text,
  monto         numeric(10,2) NOT NULL CHECK (monto > 0),
  fecha         date NOT NULL DEFAULT CURRENT_DATE,
  recurrente    boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.gastos IS 'Gastos operativos de la maestra: viáticos, materiales didácticos, plataformas, impuestos.';

CREATE INDEX IF NOT EXISTS idx_gastos_maestra ON public.gastos(maestra_id);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON public.gastos(maestra_id, fecha DESC);

-- ============================================================
-- TABLA: pagos
-- Cobros por clase dictada, vinculado a alumno y opcionalmente a clase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pagos (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  maestra_id    uuid NOT NULL REFERENCES public.maestras(id) ON DELETE CASCADE,
  alumno_id     uuid NOT NULL REFERENCES public.alumnos(id) ON DELETE CASCADE,
  clase_id      uuid REFERENCES public.clases(id) ON DELETE SET NULL,
  monto         numeric(10,2) NOT NULL CHECK (monto > 0),
  estado        estado_pago NOT NULL DEFAULT 'pendiente',
  fecha_pago    date,
  nota          text,
  created_at    timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.pagos IS 'Registro de cobros por clase. Estado trackea el ciclo: pendiente → pagado/parcial/cancelado.';

CREATE INDEX IF NOT EXISTS idx_pagos_maestra ON public.pagos(maestra_id);
CREATE INDEX IF NOT EXISTS idx_pagos_alumno ON public.pagos(maestra_id, alumno_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON public.pagos(maestra_id, estado);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON public.pagos(maestra_id, fecha_pago DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.tarifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tarifas_own_maestra" ON public.tarifas
  FOR ALL USING (maestra_id = auth.uid());

CREATE POLICY "gastos_own_maestra" ON public.gastos
  FOR ALL USING (maestra_id = auth.uid());

CREATE POLICY "pagos_own_maestra" ON public.pagos
  FOR ALL USING (maestra_id = auth.uid());

-- ============================================================
-- FUNCIÓN RPC: calcular_saldo_alumno
-- Calcula clases dictadas, total cobrado y saldo pendiente
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
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH clases_count AS (
    SELECT COUNT(*) AS total
    FROM public.clase_alumnos ca
    JOIN public.clases c ON c.id = ca.clase_id
    WHERE ca.alumno_id = p_alumno_id
      AND c.maestra_id = p_maestra_id
  ),
  tarifa_activa AS (
    SELECT COALESCE(
      (SELECT valor_hora FROM public.tarifas
       WHERE maestra_id = p_maestra_id AND activa = true
       ORDER BY vigente_desde DESC LIMIT 1),
      0
    ) AS valor
  ),
  cobrado AS (
    SELECT COALESCE(SUM(monto), 0) AS total
    FROM public.pagos
    WHERE alumno_id = p_alumno_id
      AND maestra_id = p_maestra_id
      AND estado IN ('pagado', 'parcial')
  )
  SELECT
    clases_count.total,
    (clases_count.total * tarifa_activa.valor),
    cobrado.total,
    (clases_count.total * tarifa_activa.valor) - cobrado.total
  FROM clases_count, tarifa_activa, cobrado;
$$;

-- ============================================================
-- FUNCIÓN RPC: resumen_financiero_mes
-- Resumen de ingresos y gastos del mes actual
-- ============================================================

CREATE OR REPLACE FUNCTION public.resumen_financiero_mes(p_maestra_id uuid)
RETURNS TABLE(
  ingresos_mes numeric,
  gastos_mes numeric,
  ganancia_neta numeric,
  pagos_pendientes bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH ingresos AS (
    SELECT COALESCE(SUM(monto), 0) AS total
    FROM public.pagos
    WHERE maestra_id = p_maestra_id
      AND estado = 'pagado'
      AND fecha_pago >= date_trunc('month', CURRENT_DATE)
  ),
  gastos AS (
    SELECT COALESCE(SUM(monto), 0) AS total
    FROM public.gastos
    WHERE maestra_id = p_maestra_id
      AND fecha >= date_trunc('month', CURRENT_DATE)
  ),
  pendientes AS (
    SELECT COUNT(*) AS total
    FROM public.pagos
    WHERE maestra_id = p_maestra_id
      AND estado = 'pendiente'
  )
  SELECT
    ingresos.total,
    gastos.total,
    ingresos.total - gastos.total,
    pendientes.total
  FROM ingresos, gastos, pendientes;
$$;
