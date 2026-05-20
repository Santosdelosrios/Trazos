// ============================================================
// Tool executor: finanzas (resumen, feriados)
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolResult } from "../types";

export async function resumenFinanciero(
  supabase: SupabaseClient,
  maestraId: string
): Promise<ToolResult> {
  const { data, error } = await supabase.rpc("resumen_financiero_mes", {
    p_maestra_id: maestraId,
  });

  if (error) {
    return { success: false, data: { error: error.message }, summary: "Error en resumen financiero" };
  }

  const resumen = Array.isArray(data) ? data[0] : data;

  return {
    success: true,
    data: {
      ingresos_mes: resumen?.ingresos_mes ?? 0,
      gastos_mes: resumen?.gastos_mes ?? 0,
      ganancia_neta: resumen?.ganancia_neta ?? 0,
      pagos_pendientes: resumen?.pagos_pendientes ?? 0,
    },
    summary: `Ganancia neta del mes: $${resumen?.ganancia_neta ?? 0}`,
  };
}

export async function consultarFeriadosTool(anio: number): Promise<ToolResult> {
  const { getFeriados, formatFeriadoDate } = await import("@/lib/utils/feriados");
  const feriados = await getFeriados(anio);
  const feriadosList = feriados.map((f) => `${formatFeriadoDate(f, anio)}: ${f.motivo} (${f.tipo})`);

  return {
    success: true,
    data: { anio, feriados: feriadosList, total: feriadosList.length },
    summary: `Consulté ${feriadosList.length} feriados de Argentina para el año ${anio}.`,
  };
}
