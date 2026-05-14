"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkAlumnoLimit } from "@/lib/plan";

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

  const nombre = formData.get("nombre") as string;
  const apellido = formData.get("apellido") as string;
  const grado = formData.get("grado") as string;
  const notas = formData.get("notas") as string;

  const { error } = await supabase.from("alumnos").insert({
    maestra_id: user.id,
    nombre,
    apellido,
    grado,
    notas: notas || null,
  });

  if (error) {
    throw new Error("Error al crear alumno: " + error.message);
  }

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

  revalidatePath("/alumnos");
  return { success: true };
}
