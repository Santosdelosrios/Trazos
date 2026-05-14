-- ============================================================
-- Migración 007: Métricas de Salud del Negocio
-- ============================================================

CREATE OR REPLACE FUNCTION public.obtener_metricas_negocio(p_maestra_id uuid)
RETURNS TABLE (
  horas_mes bigint,
  alumno_estrella text,
  materia_top text
) AS $$
DECLARE
  v_horas bigint;
  v_alumno text;
  v_materia text;
BEGIN
  -- Horas (Clases dictadas este mes - asumiendo 1h por clase)
  SELECT COUNT(*) INTO v_horas
  FROM public.clases
  WHERE maestra_id = p_maestra_id
    AND fecha >= date_trunc('month', CURRENT_DATE);

  -- Alumno más rentable (basado en suma de pagos pagados)
  SELECT (a.nombre || ' ' || a.apellido) INTO v_alumno
  FROM public.pagos p
  JOIN public.alumnos a ON p.alumno_id = a.id
  WHERE p.maestra_id = p_maestra_id
    AND p.estado = 'pagado'
  GROUP BY a.id, a.nombre, a.apellido
  ORDER BY SUM(p.monto) DESC
  LIMIT 1;

  -- Materia más pedida (basado en clases de este mes)
  SELECT materia INTO v_materia
  FROM public.clases
  WHERE maestra_id = p_maestra_id
    AND fecha >= date_trunc('month', CURRENT_DATE)
  GROUP BY materia
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RETURN QUERY SELECT 
    COALESCE(v_horas, 0), 
    COALESCE(v_alumno, '—'), 
    COALESCE(v_materia, '—');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.obtener_metricas_negocio IS 'Retorna métricas clave sobre el desempeño del negocio de la maestra para el mes actual.';
