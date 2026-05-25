"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { checkAlumnoLimit } from "@/lib/plan";
import { CrearAlumnoSchema, ActualizarAlumnoSchema } from "@/lib/validations/schemas";
import { TAG } from "@/lib/db/tags";

export async function createAlumno(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No autenticado");
  }

  // Verificar límite de alumnos según el plan
  const limit = await checkAlumnoLimit(supabase, user.id);
  if (!limit.allowed) {
    throw new Error(
      `Alcanzaste el máximo de ${limit.max} alumnos en el plan gratuito. Pasá a Premium para tener alumnos ilimitados.`
    );
  }

  // Validación zod centralizada
  const parsed = CrearAlumnoSchema.safeParse({
    nombre: formData.get("nombre"),
    apellido: formData.get("apellido"),
    grado: formData.get("grado"),
    notas: formData.get("notas") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const { error } = await supabase.from("alumnos").insert({
    maestra_id: user.id,
    nombre: parsed.data.nombre,
    apellido: parsed.data.apellido,
    grado: parsed.data.grado,
    notas: parsed.data.notas || null,
  });

  if (error) {
    throw new Error("Error al crear alumno: " + error.message);
  }

  revalidateTag(TAG.ALUMNOS, "max");
  revalidatePath("/alumnos");
}

export async function deleteAlumno(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No autenticado");
  }

  const { error } = await supabase
    .from("alumnos")
    .delete()
    .eq("id", id)
    .eq("maestra_id", user.id);

  if (error) {
    throw new Error("Error al eliminar alumno: " + error.message);
  }

  revalidateTag(TAG.ALUMNOS, "max");
  revalidatePath("/alumnos");
  return { success: true };
}

export async function updateAlumno(id: string, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No autenticado");
  }

  const tarifaRaw = formData.get("tarifa_override") as string | null;
  const parsed = ActualizarAlumnoSchema.safeParse({
    nombre: formData.get("nombre"),
    apellido: formData.get("apellido"),
    grado: formData.get("grado"),
    notas: formData.get("notas") || undefined,
    modelo_cobro: formData.get("modelo_cobro") || "por_clase",
    tarifa_override: tarifaRaw && tarifaRaw.trim() !== "" ? tarifaRaw : null,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const { error } = await supabase
    .from("alumnos")
    .update({
      nombre: parsed.data.nombre,
      apellido: parsed.data.apellido,
      grado: parsed.data.grado,
      notas: parsed.data.notas || null,
      modelo_cobro: parsed.data.modelo_cobro,
      tarifa_override: parsed.data.tarifa_override,
    })
    .eq("id", id)
    .eq("maestra_id", user.id);

  if (error) {
    throw new Error("Error al actualizar alumno: " + error.message);
  }

  revalidatePath(`/alumnos/${id}`);
  revalidateTag(TAG.ALUMNOS, "max");
  revalidatePath("/alumnos");
  return { success: true };
}
