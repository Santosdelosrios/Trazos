// ============================================================
// Queries layer — fachada tipada sobre Supabase
//
// Centraliza las queries más usadas en la app. Cada función:
// - Recibe el SupabaseClient (server o cliente) + maestraId
// - Devuelve tipos del dominio (no datos crudos de Supabase)
// - Encapsula los `.select(...)` y joins, para que un cambio de
//   schema solo requiera tocar este archivo
//
// Convención: las funciones de READ retornan el dato directo o
// `null` si no existe; las que listan retornan array (nunca null).
// No tiran throws: los errores de Supabase se loguean y se devuelve
// null/[] para que la UI maneje el caso vacío.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Alumno,
  ResumenFinancieroMes,
  ModeloCobro,
} from "@/lib/types/database";

// ------------------------------------------------------------
// Alumnos
// ------------------------------------------------------------

export interface AlumnoBasico {
  id: string;
  nombre: string;
  apellido: string;
  grado: string;
  modelo_cobro: ModeloCobro;
}

export async function getAlumnosBasicos(
  supabase: SupabaseClient,
  maestraId: string
): Promise<AlumnoBasico[]> {
  const { data, error } = await supabase
    .from("alumnos")
    .select("id, nombre, apellido, grado, modelo_cobro")
    .eq("maestra_id", maestraId)
    .order("nombre");

  if (error) {
    console.error("getAlumnosBasicos error:", error);
    return [];
  }
  return (data || []).map((a) => ({
    id: a.id,
    nombre: a.nombre,
    apellido: a.apellido,
    grado: a.grado,
    modelo_cobro: (a.modelo_cobro || "por_clase") as ModeloCobro,
  }));
}

export async function getAlumnoById(
  supabase: SupabaseClient,
  maestraId: string,
  alumnoId: string
): Promise<Alumno | null> {
  const { data, error } = await supabase
    .from("alumnos")
    .select("*")
    .eq("id", alumnoId)
    .eq("maestra_id", maestraId)
    .maybeSingle();

  if (error) {
    console.error("getAlumnoById error:", error);
    return null;
  }
  return (data as Alumno) || null;
}

/**
 * Devuelve los saldos pendientes por alumno via RPC.
 * Más eficiente que iterar `consultar_saldo` por cada alumno.
 */
export async function getSaldosMap(
  supabase: SupabaseClient,
  maestraId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("calcular_saldos_maestra", {
    p_maestra_id: maestraId,
  });

  if (error || !Array.isArray(data)) {
    if (error) console.error("getSaldosMap error:", error);
    return {};
  }

  const map: Record<string, number> = {};
  for (const row of data as Array<{ alumno_id?: string; saldo_pendiente?: number }>) {
    if (row?.alumno_id) {
      map[row.alumno_id] = Number(row.saldo_pendiente) || 0;
    }
  }
  return map;
}

// ------------------------------------------------------------
// Clases / Agenda
// ------------------------------------------------------------

export async function getClasesDelMes(
  supabase: SupabaseClient,
  maestraId: string,
  startOfMonth: Date
): Promise<number> {
  const { count, error } = await supabase
    .from("clases")
    .select("*", { count: "exact", head: true })
    .eq("maestra_id", maestraId)
    .gte("fecha", startOfMonth.toISOString());

  if (error) {
    console.error("getClasesDelMes error:", error);
    return 0;
  }
  return count ?? 0;
}

export async function getAgendaPendiente(
  supabase: SupabaseClient,
  maestraId: string
) {
  const { data, error } = await supabase
    .from("agenda")
    .select(`
      id, fecha, hora, tema_previsto, materia, alumno_id, duracion_estimada, estado,
      alumnos!inner(id, nombre, apellido)
    `)
    .eq("maestra_id", maestraId)
    .eq("estado", "pendiente")
    .order("fecha", { ascending: true })
    .order("hora", { ascending: true });

  if (error) {
    console.error("getAgendaPendiente error:", error);
    return [];
  }
  return data || [];
}

// ------------------------------------------------------------
// Stats de evaluaciones (promedio, comprensión)
// ------------------------------------------------------------

export interface EvaluacionStats {
  promedioGeneral: string;
  tasaComprension: string;
}

export async function getEvaluacionStats(
  supabase: SupabaseClient,
  maestraId: string
): Promise<EvaluacionStats> {
  const { data, error } = await supabase
    .from("clase_alumnos")
    .select("nota, autoevaluacion, clases!inner(maestra_id)")
    .eq("clases.maestra_id", maestraId)
    .not("nota", "is", null);

  if (error || !data || data.length === 0) {
    if (error) console.error("getEvaluacionStats error:", error);
    return { promedioGeneral: "—", tasaComprension: "—" };
  }

  let promedioGeneral = "—";
  let tasaComprension = "—";

  const notas = data
    .map((d) => (d as { nota: number | null }).nota)
    .filter((n): n is number => n !== null);
  if (notas.length > 0) {
    const sum = notas.reduce((a, b) => a + b, 0);
    promedioGeneral = (sum / notas.length).toFixed(1);
  }

  const autoevals = data
    .map((d) => (d as { autoevaluacion: number | null }).autoevaluacion)
    .filter((a): a is number => a !== null);
  if (autoevals.length > 0) {
    const altas = autoevals.filter((a) => a >= 3).length;
    tasaComprension = Math.round((altas / autoevals.length) * 100) + "%";
  }

  return { promedioGeneral, tasaComprension };
}

// ------------------------------------------------------------
// Finanzas
// ------------------------------------------------------------

export async function getResumenFinanciero(
  supabase: SupabaseClient,
  maestraId: string
): Promise<ResumenFinancieroMes | null> {
  const { data, error } = await supabase.rpc("resumen_financiero_mes", {
    p_maestra_id: maestraId,
  });

  if (error) {
    console.error("getResumenFinanciero error:", error);
    return null;
  }
  return (data?.[0] as ResumenFinancieroMes) ?? null;
}

// ------------------------------------------------------------
// Maestra (perfil)
// ------------------------------------------------------------

export async function getNombreMaestra(
  supabase: SupabaseClient,
  maestraId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("maestras")
    .select("nombre")
    .eq("id", maestraId)
    .maybeSingle();

  if (error) {
    console.error("getNombreMaestra error:", error);
    return null;
  }
  return data?.nombre ?? null;
}
