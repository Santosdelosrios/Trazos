-- ============================================================
-- Migración 008: Duración de Clases
-- Agrega soporte para duraciones variables en agenda y clases
-- ============================================================

-- 1. Agregar columnas de duración
ALTER TABLE public.agenda
ADD COLUMN IF NOT EXISTS duracion_estimada numeric(4,2) DEFAULT 1;

ALTER TABLE public.clases
ADD COLUMN IF NOT EXISTS duracion_real numeric(4,2) DEFAULT 1;

COMMENT ON COLUMN public.agenda.duracion_estimada IS 'Duración estimada de la clase en horas (ej: 1.5).';
COMMENT ON COLUMN public.clases.duracion_real IS 'Duración real de la clase en horas, puede diferir de la estimada.';

-- 2. Actualizar funciones de métricas si es necesario
-- (Opcional: podríamos sumar duracion_real en lugar de contar clases en obtener_metricas_negocio)
CREATE OR REPLACE FUNCTION public.obtener_metricas_negocio(p_maestra_id uuid)
RETURNS TABLE (
  horas_mes numeric(10,2),
  alumno_estrella text,
  materia_top text
) AS $$
DECLARE
  v_horas numeric(10,2);
  v_alumno text;
  v_materia text;
BEGIN
  -- Horas (Suma de duracion_real este mes)
  SELECT COALESCE(SUM(duracion_real), 0) INTO v_horas
  FROM public.clases
  WHERE maestra_id = p_maestra_id
    AND fecha >= date_trunc('month', CURRENT_DATE);

  -- Alumno más rentable
  SELECT (a.nombre || ' ' || a.apellido) INTO v_alumno
  FROM public.pagos p
  JOIN public.alumnos a ON p.alumno_id = a.id
  WHERE p.maestra_id = p_maestra_id
    AND p.estado = 'pagado'
  GROUP BY a.id, a.nombre, a.apellido
  ORDER BY SUM(p.monto) DESC
  LIMIT 1;

  -- Materia más pedida
  SELECT materia INTO v_materia
  FROM public.clases
  WHERE maestra_id = p_maestra_id
    AND fecha >= date_trunc('month', CURRENT_DATE)
  GROUP BY materia
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RETURN QUERY SELECT 
    v_horas, 
    COALESCE(v_alumno, '—'), 
    COALESCE(v_materia, '—');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
