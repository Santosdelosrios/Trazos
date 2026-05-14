// ============================================================
// Materias Helper — Maneja materias base + custom por maestra
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export interface MateriaOption {
  value: string;
  label: string;
  icono: string;
  isCustom: boolean;
}

/** Las 5 materias base que vienen con Trazos */
export const BASE_MATERIAS: MateriaOption[] = [
  { value: "matematica", label: "Matemática", icono: "calculator", isCustom: false },
  { value: "lengua", label: "Lengua y Literatura", icono: "book-open", isCustom: false },
  { value: "cs_naturales", label: "Ciencias Naturales", icono: "leaf", isCustom: false },
  { value: "cs_sociales", label: "Ciencias Sociales", icono: "globe", isCustom: false },
  { value: "otro", label: "Otro", icono: "pencil", isCustom: false },
];

/**
 * Obtiene todas las materias disponibles para una maestra,
 * combinando las base (menos las ocultas) con las personalizadas.
 */
export async function getMateriasForTeacher(
  supabase: SupabaseClient,
  userId: string
): Promise<MateriaOption[]> {
  const [{ data: maestraData }, { data: customMaterias }] = await Promise.all([
    supabase
      .from("maestras")
      .select("materias_ocultas")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("materias_custom")
      .select("id, nombre, icono")
      .eq("maestra_id", userId)
      .order("nombre"),
  ]);

  // Parse hidden materias
  let ocultas: string[] = [];
  try {
    ocultas = JSON.parse(maestraData?.materias_ocultas || "[]");
  } catch {
    ocultas = [];
  }

  // Filter base materias
  const visibleBase = BASE_MATERIAS.filter((m) => !ocultas.includes(m.value));

  // Map custom materias
  const custom: MateriaOption[] = (customMaterias || []).map((m: any) => ({
    value: `custom_${m.id}`,
    label: m.nombre,
    icono: m.icono || "book",
    isCustom: true,
  }));

  return [...visibleBase, ...custom];
}
