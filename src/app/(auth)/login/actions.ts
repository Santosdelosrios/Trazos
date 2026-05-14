"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  let redirectUrl = "";
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Login error:", error.message);
      redirectUrl = "/login?error=" + encodeURIComponent(error.message);
    } else {
      redirectUrl = "/dashboard";
    }
  } catch (e: any) {
    if (e.message?.includes("NEXT_REDIRECT")) throw e;
    console.error("Unexpected login error:", e);
    redirectUrl = "/login?error=" + encodeURIComponent(e.message || "Error de conexión");
  }

  if (redirectUrl) {
    redirect(redirectUrl);
  }
}
