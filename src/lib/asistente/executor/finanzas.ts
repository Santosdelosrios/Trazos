// ============================================================
// Tool executor: finanzas (resumen, feriados)
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolResult } from "../types";
import { obtenerBriefing } from "@/lib/briefing";

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

export async function obtenerBriefingHoy(
  supabase: SupabaseClient,
  maestraId: string
): Promise<ToolResult> {
  const b = await obtenerBriefing(supabase, maestraId);

  return {
    success: true,
    data: {
      clases_hoy: b.clasesHoy,
      proxima_clase: b.proximaClase
        ? `${b.proximaClase.hora} con ${b.proximaClase.alumno}`
        : null,
      familias_con_deuda: b.deudores.count,
      monto_total_adeudado: b.deudores.total,
      nombres_deudores: b.deudores.nombres,
      feriado_hoy: b.feriadoHoy,
    },
    summary:
      `Hoy tenés ${b.clasesHoy} clase(s)` +
      (b.proximaClase ? ` (próxima ${b.proximaClase.hora})` : "") +
      (b.deudores.count > 0
        ? `. ${b.deudores.count} familia(s) deben $${b.deudores.total.toLocaleString("es-AR")}`
        : ". Cobros al día") +
      (b.feriadoHoy ? `. Ojo: hoy es feriado (${b.feriadoHoy})` : "") +
      ".",
  };
}
