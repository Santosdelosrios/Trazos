"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getPlan } from "@/lib/plan";
import { BASE_MATERIAS } from "@/lib/materias";

export async function addCustomMateria(nombre: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const plan = await getPlan(supabase, user.id);
  if (plan !== "premium") {
    throw new Error("Las materias personalizadas son una función Premium.");
  }

  const trimmed = nombre.trim();
  if (trimmed.length < 2) {
    throw new Error("El nombre de la materia debe tener al menos 2 caracteres.");
  }

  const { error } = await supabase.from("materias_custom").insert({
    maestra_id: user.id,
    nombre: trimmed,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya tenés una materia con ese nombre.");
    }
    throw new Error("Error al agregar materia: " + error.message);
  }

  revalidatePath("/perfil");
}

export async function deleteCustomMateria(materiaId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("materias_custom")
    .delete()
    .eq("id", materiaId)
    .eq("maestra_id", user.id);

  if (error) throw new Error("Error al eliminar materia: " + error.message);
  revalidatePath("/perfil");
}

export async function toggleBaseMateria(materiaValue: string, hide: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const plan = await getPlan(supabase, user.id);
  if (plan !== "premium") {
    throw new Error("Gestionar materias es una función Premium.");
  }

  // Get current hidden list
  const { data } = await supabase
    .from("maestras")
    .select("materias_ocultas")
    .eq("id", user.id)
    .single();

  let ocultas: string[] = [];
  try {
    ocultas = JSON.parse(data?.materias_ocultas || "[]");
  } catch {
    ocultas = [];
  }

  if (hide) {
    // Don't allow hiding ALL materias
    const visibleCount = BASE_MATERIAS.length - ocultas.length;
    if (visibleCount <= 1) {
      throw new Error("Tenés que tener al menos una materia visible.");
    }
    if (!ocultas.includes(materiaValue)) {
      ocultas.push(materiaValue);
    }
  } else {
    ocultas = ocultas.filter((v) => v !== materiaValue);
  }

  await supabase
    .from("maestras")
    .update({ materias_ocultas: JSON.stringify(ocultas) })
    .eq("id", user.id);

  revalidatePath("/perfil");
}
