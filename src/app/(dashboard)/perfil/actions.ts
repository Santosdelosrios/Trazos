"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const nombre = formData.get("nombre") as string;

  // 1. Update auth user metadata
  const { error: authError } = await supabase.auth.updateUser({
    data: { nombre },
  });

  if (authError) {
    console.error("Error updating auth metadata:", authError.message);
    redirect("/perfil?error=" + encodeURIComponent("No se pudo actualizar el perfil."));
  }

  // 2. Update maestras table (if it exists)
  await supabase
    .from("maestras")
    .update({ nombre })
    .eq("id", user.id);

  revalidatePath("/perfil");
  redirect("/perfil?success=true");
}

export async function setMensajeria(data: {
  datos_pago: string | null;
  template_recordatorio: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Trim + normalización: string vacío → NULL (que el template caiga
  // al default sin tener que blanquear con SQL).
  const datosPago = data.datos_pago && data.datos_pago.trim()
    ? data.datos_pago.trim()
    : null;
  const template = data.template_recordatorio && data.template_recordatorio.trim()
    ? data.template_recordatorio
    : null;

  if (datosPago && datosPago.length > 500) {
    throw new Error("Los datos de pago no pueden superar los 500 caracteres.");
  }
  if (template && template.length > 2000) {
    throw new Error("El template no puede superar los 2000 caracteres.");
  }

  const { error } = await supabase
    .from("maestras")
    .update({
      datos_pago: datosPago,
      template_recordatorio: template,
    })
    .eq("id", user.id);

  if (error) throw new Error("No se pudo guardar la mensajería: " + error.message);

  revalidatePath("/perfil");
  revalidatePath("/finanzas/cobranzas");
  revalidatePath("/finanzas/cuentas");
}

export async function setCobrosAutomaticos(activado: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("maestras")
    .update({ cobros_automaticos_clases: activado })
    .eq("id", user.id);

  if (error) throw new Error("No se pudo actualizar la preferencia: " + error.message);

  revalidatePath("/perfil");
  revalidatePath("/finanzas");
}

export async function deleteAccount() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("delete_my_account");

  if (error) {
    console.error("Error deleting account:", error);
    redirect("/perfil?error=" + encodeURIComponent("No se pudo eliminar la cuenta. Error: " + error.message));
  }

  await supabase.auth.signOut();
  redirect("/login");
}
