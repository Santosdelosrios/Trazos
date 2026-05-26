"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { GuardarFamiliaSchema, AsignarFamiliaSchema } from "@/lib/validations/schemas";
import { TAG } from "@/lib/db/tags";
import { normalizarTelefonoAR } from "@/lib/finanzas/responsable";

// ------------------------------------------------------------
// CRUD familias
// ------------------------------------------------------------

export async function crearFamilia(data: {
  nombre: string;
  responsable_nombre?: string | null;
  responsable_telefono?: string | null;
  datos_pago_override?: string | null;
  notas?: string | null;
}) {
  const parsed = GuardarFamiliaSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: inserted, error } = await supabase
    .from("familias")
    .insert({
      maestra_id: user.id,
      nombre: parsed.data.nombre,
      responsable_nombre: parsed.data.responsable_nombre || null,
      responsable_telefono: normalizarTelefonoAR(parsed.data.responsable_telefono || null),
      datos_pago_override: parsed.data.datos_pago_override || null,
      notas: parsed.data.notas || null,
    })
    .select("id")
    .single();

  if (error) throw new Error("Error al crear familia: " + error.message);

  revalidateTag(TAG.FAMILIAS, "max");
  revalidateTag(TAG.ALUMNOS, "max");
  revalidatePath("/finanzas/cuentas");
  revalidatePath("/alumnos");

  return { id: inserted!.id };
}

export async function actualizarFamilia(id: string, data: {
  nombre: string;
  responsable_nombre?: string | null;
  responsable_telefono?: string | null;
  datos_pago_override?: string | null;
  notas?: string | null;
}) {
  const parsed = GuardarFamiliaSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("familias")
    .update({
      nombre: parsed.data.nombre,
      responsable_nombre: parsed.data.responsable_nombre || null,
      responsable_telefono: normalizarTelefonoAR(parsed.data.responsable_telefono || null),
      datos_pago_override: parsed.data.datos_pago_override || null,
      notas: parsed.data.notas || null,
    })
    .eq("id", id)
    .eq("maestra_id", user.id)
    .is("deleted_at", null);

  if (error) throw new Error("Error al actualizar familia: " + error.message);

  revalidateTag(TAG.FAMILIAS, "max");
  revalidateTag(TAG.ALUMNOS, "max");
  revalidatePath("/finanzas/cuentas");
}

/** Soft delete. Los alumnos vinculados quedan con familia_id NULL por ON DELETE SET NULL,
 *  pero como acá no hacemos hard delete, los desvincula explícitamente. */
export async function eliminarFamilia(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Desvincular alumnos
  await supabase
    .from("alumnos")
    .update({ familia_id: null })
    .eq("familia_id", id)
    .eq("maestra_id", user.id);

  // Soft delete familia
  const { error } = await supabase
    .from("familias")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("maestra_id", user.id);

  if (error) throw new Error("Error al eliminar familia: " + error.message);

  revalidateTag(TAG.FAMILIAS, "max");
  revalidateTag(TAG.ALUMNOS, "max");
  revalidatePath("/finanzas/cuentas");
  revalidatePath("/alumnos");
}

// ------------------------------------------------------------
// Asignación alumno ↔ familia
// ------------------------------------------------------------

export async function asignarAlumnoAFamilia(data: {
  alumno_id: string;
  familia_id: string | null;
}) {
  const parsed = AsignarFamiliaSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Si se asigna, validamos que la familia exista y sea de la misma maestra (RLS ya filtra,
  // pero hacemos la consulta para devolver un error claro si no existe).
  if (parsed.data.familia_id) {
    const { data: fam } = await supabase
      .from("familias_activas")
      .select("id")
      .eq("id", parsed.data.familia_id)
      .maybeSingle();
    if (!fam) throw new Error("La familia indicada no existe.");
  }

  const { error } = await supabase
    .from("alumnos")
    .update({ familia_id: parsed.data.familia_id })
    .eq("id", parsed.data.alumno_id)
    .eq("maestra_id", user.id);

  if (error) throw new Error("Error al asignar familia: " + error.message);

  revalidateTag(TAG.ALUMNOS, "max");
  revalidateTag(TAG.FAMILIAS, "max");
  revalidatePath(`/alumnos/${parsed.data.alumno_id}`);
  revalidatePath("/finanzas/cuentas");
}
