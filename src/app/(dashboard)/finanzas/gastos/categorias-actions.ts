"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { GuardarCategoriaGastoSchema } from "@/lib/validations/schemas";
import { TAG } from "@/lib/db/tags";
import type { SupabaseClient } from "@supabase/supabase-js";

// ------------------------------------------------------------
// CRUD de categorías custom
// ------------------------------------------------------------

export async function crearCategoriaGasto(input: {
  nombre: string;
  icono?: string | null;
}) {
  const parsed = GuardarCategoriaGastoSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data, error } = await supabase
    .from("categorias_gasto_custom")
    .insert({
      maestra_id: user.id,
      nombre: parsed.data.nombre.trim(),
      icono: parsed.data.icono || null,
      es_default: false,
      enum_legacy: null, // las custom de la maestra caen a "otro" en el enum
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique violation: la maestra ya tiene una con ese nombre
    if (error.code === "23505") {
      throw new Error("Ya tenés una categoría con ese nombre.");
    }
    throw new Error("No se pudo crear la categoría: " + error.message);
  }

  revalidateTag(TAG.CATEGORIAS_GASTO, "max");
  revalidatePath("/finanzas/gastos");
  revalidatePath("/finanzas");

  return { id: data!.id };
}

export async function actualizarCategoriaGasto(id: string, input: {
  nombre: string;
  icono?: string | null;
}) {
  const parsed = GuardarCategoriaGastoSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("categorias_gasto_custom")
    .update({
      nombre: parsed.data.nombre.trim(),
      icono: parsed.data.icono || null,
    })
    .eq("id", id)
    .eq("maestra_id", user.id)
    .is("deleted_at", null);

  if (error) throw new Error("No se pudo actualizar: " + error.message);

  revalidateTag(TAG.CATEGORIAS_GASTO, "max");
  revalidatePath("/finanzas/gastos");
  revalidatePath("/finanzas");
}

/** Soft delete. Los gastos asociados quedan con categoria_id apuntando
 *  a la fila borrada (no se cascadea), pero como las queries usan la
 *  vista categorias_gasto_activas, esos gastos van a aparecer como
 *  "(categoría eliminada)" en la UI. */
export async function eliminarCategoriaGasto(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // No permitimos borrar defaults (es_default = true)
  const { data: cat } = await supabase
    .from("categorias_gasto_activas")
    .select("es_default")
    .eq("id", id)
    .eq("maestra_id", user.id)
    .maybeSingle();
  if (!cat) throw new Error("La categoría no existe.");
  if (cat.es_default) {
    throw new Error("No se pueden eliminar las categorías por defecto.");
  }

  const { error } = await supabase
    .from("categorias_gasto_custom")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("maestra_id", user.id);

  if (error) throw new Error("No se pudo eliminar: " + error.message);

  revalidateTag(TAG.CATEGORIAS_GASTO, "max");
  revalidatePath("/finanzas/gastos");
  revalidatePath("/finanzas");
}

// ------------------------------------------------------------
// Onboarding helper
// ------------------------------------------------------------

/**
 * Siembra las 5 categorías default para una maestra recién creada.
 * Idempotente: si ya existen (ON CONFLICT en UNIQUE) no hace nada.
 *
 * Diseñado para llamarse desde el flow de signup. La migración 022
 * ya sembró las default para las maestras existentes; este helper
 * cubre el caso de maestras nuevas.
 */
export async function ensureCategoriasDefault(
  supabase: SupabaseClient,
  maestraId: string
) {
  const defaults = [
    { nombre: "Materiales",   icono: "package",          enum_legacy: "material" as const },
    { nombre: "Transporte",   icono: "car",              enum_legacy: "viatico" as const },
    { nombre: "Capacitación", icono: "graduation-cap",   enum_legacy: null },
    { nombre: "Impuestos",    icono: "receipt",          enum_legacy: "impuesto" as const },
    { nombre: "Otros",        icono: "more-horizontal",  enum_legacy: "otro" as const },
  ];

  await supabase
    .from("categorias_gasto_custom")
    .upsert(
      defaults.map((d) => ({
        maestra_id: maestraId,
        nombre: d.nombre,
        icono: d.icono,
        es_default: true,
        enum_legacy: d.enum_legacy,
      })),
      { onConflict: "maestra_id,nombre", ignoreDuplicates: true }
    );
}
