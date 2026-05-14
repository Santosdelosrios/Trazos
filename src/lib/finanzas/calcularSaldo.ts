import { createClient } from "@/lib/supabase/server";
import type { SaldoAlumno, ResumenFinancieroMes } from "@/lib/types/database";

// Re-export the formatter so server-side callers still find it here
export { formatearMonto } from "./formatearMonto";
export async function calcularSaldoAlumno(
  alumnoId: string,
  maestraId: string
): Promise<SaldoAlumno | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("calcular_saldo_alumno", {
    p_alumno_id: alumnoId,
    p_maestra_id: maestraId,
  });

  if (error || !data || data.length === 0) return null;

  return data[0] as SaldoAlumno;
}

/**
 * Obtiene el resumen financiero del mes actual.
 * Usa la RPC `resumen_financiero_mes` definida en 005_finanzas.sql
 */
export async function obtenerResumenMes(
  maestraId: string
): Promise<ResumenFinancieroMes | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("resumen_financiero_mes", {
    p_maestra_id: maestraId,
  });

  if (error || !data || data.length === 0) return null;

  return data[0] as ResumenFinancieroMes;
}
