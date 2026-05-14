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
