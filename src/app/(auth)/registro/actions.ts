"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const nombre = formData.get("nombre") as string;

  // 1. Crear usuario en Auth
  const { data, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nombre: nombre,
      },
    },
  });

  if (authError) {
    console.error("Signup error:", authError.message);
    redirect("/registro?error=" + encodeURIComponent(authError.message));
  }

  if (data.user) {
    // 2. Insertar en la tabla maestras
    // (Esto asume que el usuario no necesita confirmación de email para este MVP, 
    // o que el trigger de DB no está configurado aún)
    const { error: dbError } = await supabase.from("maestras").insert({
      id: data.user.id,
      nombre: nombre,
      email: email,
    });

    if (dbError) {
      console.error("DB maestra insert error:", dbError.message);
      // Podríamos borrar el usuario de auth aquí, pero mejor lo dejamos así para este MVP
    }
  }

  redirect("/dashboard");
}
