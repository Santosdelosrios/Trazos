// ============================================================
// Tool executor: alumnos
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolResult } from "../types";

export async function buscarAlumno(
  supabase: SupabaseClient,
  maestraId: string,
  query: string
): Promise<ToolResult> {
  let queryBuilder = supabase
    .from("alumnos")
    .select("id, nombre, apellido, grado, modelo_cobro, saldo_actual")
    .eq("maestra_id", maestraId);

  const tokens = query.trim().split(/\s+/);
  for (const token of tokens) {
    queryBuilder = queryBuilder.or(`nombre.ilike.%${token}%,apellido.ilike.%${token}%`);
  }

  const { data, error } = await queryBuilder.limit(5);

  if (error) {
    return { success: false, data: { error: error.message }, summary: "Error buscando alumno" };
  }

  if (!data || data.length === 0) {
    return {
      success: true,
      data: { alumnos: [], count: 0 },
      summary: `No se encontraron alumnos con "${query}"`,
    };
  }

  return {
    success: true,
    data: {
      alumnos: data.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        apellido: a.apellido,
        grado: a.grado,
        modelo_cobro: a.modelo_cobro || "por_clase",
        saldo_actual: a.saldo_actual || 0,
      })),
      count: data.length,
    },
    summary: `Encontré ${data.length} alumno(s) con "${query}"`,
  };
}

export async function cambiarModeloCobro(
  supabase: SupabaseClient,
  maestraId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const alumnoId = args.alumno_id as string;
  const nuevoModelo = args.nuevo_modelo as string;
  const tarifaOverride = args.tarifa_override as number | undefined;

  const validModels = ["por_clase", "bolsa_creditos", "abono_mensual", "cuenta_corriente"];
  if (!validModels.includes(nuevoModelo)) {
    return { success: false, data: { error: "Modelo inválido" }, summary: "Modelo de cobro no reconocido" };
  }

  const { error } = await supabase
    .from("alumnos")
    .update({
      modelo_cobro: nuevoModelo,
      tarifa_override: tarifaOverride ?? null,
    })
    .eq("id", alumnoId)
    .eq("maestra_id", maestraId);

  if (error) {
    return { success: false, data: { error: error.message }, summary: "Error actualizando modelo de cobro" };
  }

  return {
    success: true,
    data: { alumno_id: alumnoId, nuevo_modelo: nuevoModelo, tarifa_override: tarifaOverride },
    summary: `Cambié el modelo de cobro a '${nuevoModelo}'${tarifaOverride ? ` con una tarifa personalizada de $${tarifaOverride}` : ""}.`,
  };
}
