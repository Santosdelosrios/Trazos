// ============================================================
// Plan Helper — Centraliza toda la lógica de planes Free/Premium
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export type Plan = "free" | "premium";

// --- Límites por plan ---
export const PLAN_LIMITS = {
  free: {
    maxAlumnos: 10,
    label: "Gratis",
    color: "bg-surface-100 text-surface-600",
  },
  premium: {
    maxAlumnos: Infinity,
    label: "Premium",
    color: "bg-gradient-to-r from-amber-400 to-amber-500 text-white",
  },
} as const;

/**
 * Obtiene el plan de una maestra desde la BD.
 * Si no puede determinarlo, devuelve "free" como fallback seguro.
 */
export async function getPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<Plan> {
  const { data } = await supabase
    .from("maestras")
    .select("plan, premium_until")
    .eq("id", userId)
    .maybeSingle();

  if (data?.plan === "premium" && data?.premium_until) {
    if (new Date(data.premium_until) < new Date()) {
      // El plan expiró, lo actualizamos silenciosamente a "free"
      await supabase
        .from("maestras")
        .update({ plan: "free", premium_until: null })
        .eq("id", userId);
      return "free";
    }
  }

  return (data?.plan as Plan) || "free";
}

/**
 * Verifica si la maestra puede agregar más alumnos.
 * Retorna { allowed, current, max }
 */
export async function checkAlumnoLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; current: number; max: number }> {
  const [plan, { count }] = await Promise.all([
    getPlan(supabase, userId),
    supabase
      .from("alumnos")
      .select("*", { count: "exact", head: true })
      .eq("maestra_id", userId),
  ]);

  const current = count ?? 0;
  const max = PLAN_LIMITS[plan].maxAlumnos;

  return {
    allowed: current < max,
    current,
    max,
  };
}
