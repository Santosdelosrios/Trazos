// ============================================================
// Tool executor: agenda (agendar, cancelar, consultar día)
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolResult } from "../types";

export async function agendarClases(
  supabase: SupabaseClient,
  maestraId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const alumnoId = args.alumno_id as string;
  const fechas = (args.fechas as string[]) || [];
  const hora = args.hora as string;
  const duracion = (args.duracion_estimada as number) ?? 1;
  const confirmacionFeriado = args.confirmacion_feriado as boolean | undefined;

  if (fechas.length === 0) {
    return { success: false, data: { error: "Faltan fechas" }, summary: "No se proporcionaron fechas para agendar." };
  }

  // Validación de Feriados (Soft Warning)
  if (!confirmacionFeriado) {
    const { getFeriados, formatFeriadoDate } = await import("@/lib/utils/feriados");
    const primeraFecha = new Date(fechas[0] + "T12:00:00");
    const anio = isNaN(primeraFecha.getTime()) ? new Date().getFullYear() : primeraFecha.getFullYear();
    const feriados = await getFeriados(anio);

    const feriadosMatch = fechas
      .map((fecha) => {
        const isFeriado = feriados.find((f) => formatFeriadoDate(f, anio) === fecha);
        return isFeriado ? { fecha, motivo: isFeriado.motivo } : null;
      })
      .filter(Boolean);

    if (feriadosMatch.length > 0) {
      const match = feriadosMatch[0]!;
      return {
        success: false,
        data: { error_feriado: true, fecha: match.fecha, motivo: match.motivo },
        summary: `Pausa: la fecha ${match.fecha} es feriado por ${match.motivo}. Preguntale a la maestra si quiere agendar igual. Si dice que sí, volvé a llamar a agendar_clases con confirmacion_feriado en true.`,
      };
    }
  }

  // Obtener tarifa activa
  const { data: tarifa } = await supabase
    .from("tarifas")
    .select("valor_hora")
    .eq("maestra_id", maestraId)
    .eq("activa", true)
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rows = fechas.map((fecha) => ({
    maestra_id: maestraId,
    alumno_id: alumnoId,
    fecha,
    hora,
    materia: "otro",
    duracion_estimada: duracion,
    estado: "pendiente",
    tarifa_esperada: tarifa?.valor_hora ?? null,
  }));

  const { data, error } = await supabase.from("agenda").insert(rows).select("id, fecha, hora");

  if (error) {
    return { success: false, data: { error: error.message }, summary: "Error agendando clases" };
  }

  const fechasResult = (data || []).map((r) => r.fecha);
  return {
    success: true,
    data: { clases_agendadas: data?.length ?? 0, fechas: fechasResult },
    summary: `Agendé ${data?.length ?? 0} clase(s) a las ${hora} para las fechas solicitadas.`,
  };
}

export async function cancelarClases(
  supabase: SupabaseClient,
  maestraId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const alumnoId = args.alumno_id as string;
  const fechas = args.fechas as string[];

  const { data, error } = await supabase
    .from("agenda")
    .delete()
    .eq("maestra_id", maestraId)
    .eq("alumno_id", alumnoId)
    .in("fecha", fechas)
    .select("id, fecha");

  if (error) {
    return { success: false, data: { error: error.message }, summary: "Error cancelando clases" };
  }

  return {
    success: true,
    data: { clases_canceladas: data?.length ?? 0, fechas: data?.map((d) => d.fecha) || [] },
    summary: `Cancelé ${data?.length ?? 0} clase(s) en las fechas indicadas.`,
  };
}

export async function verAgendaDia(
  supabase: SupabaseClient,
  maestraId: string,
  fecha: string
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from("agenda")
    .select("id, hora, estado, duracion_estimada, alumnos(nombre, apellido)")
    .eq("maestra_id", maestraId)
    .eq("fecha", fecha)
    .order("hora", { ascending: true });

  if (error) {
    return { success: false, data: { error: error.message }, summary: "Error consultando agenda" };
  }

  const clases = (data || []).map((item) => {
    const alumnoObj = item.alumnos as { nombre?: string; apellido?: string } | null;
    return {
      hora: item.hora,
      alumno: alumnoObj
        ? `${alumnoObj.nombre || ""} ${alumnoObj.apellido || ""}`.trim()
        : "Sin alumno",
      estado: item.estado,
      duracion: item.duracion_estimada,
    };
  });

  return {
    success: true,
    data: { fecha, clases, total: clases.length },
    summary: clases.length > 0
      ? `Tenés ${clases.length} clase(s) agendada(s) para el ${fecha}`
      : `No tenés clases agendadas para el ${fecha}`,
  };
}
