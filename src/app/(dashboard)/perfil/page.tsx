import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PerfilClient from "./PerfilClient";

export const metadata = {
  title: "Mi Perfil | Trazos",
};

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch stats in parallel
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    { count: totalAlumnos },
    { count: totalClases },
    { count: clasesMes },
    { data: maestraData },
  ] = await Promise.all([
    supabase
      .from("alumnos")
      .select("*", { count: "exact", head: true })
      .eq("maestra_id", user.id),

    supabase
      .from("clases")
      .select("*", { count: "exact", head: true })
      .eq("maestra_id", user.id),

    supabase
      .from("clases")
      .select("*", { count: "exact", head: true })
      .eq("maestra_id", user.id)
      .gte("fecha", startOfMonth.toISOString()),

    supabase
      .from("maestras")
      .select("nombre, created_at, plan, calendar_token, cobros_automaticos_clases, datos_pago, template_recordatorio")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const plan = (maestraData?.plan as "free" | "premium") || "free";

  const profileData = {
    email: user.email || "",
    nombre: maestraData?.nombre || user.user_metadata?.nombre || "",
    createdAt: maestraData?.created_at || user.created_at,
    plan,
    calendarToken: maestraData?.calendar_token || null,
    totalAlumnos: totalAlumnos ?? 0,
    totalClases: totalClases ?? 0,
    clasesMes: clasesMes ?? 0,
    cobrosAutomaticos: maestraData?.cobros_automaticos_clases !== false,
    datosPago: maestraData?.datos_pago ?? null,
    templateRecordatorio: maestraData?.template_recordatorio ?? null,
  };

  return (
    <PerfilClient
      profile={profileData}
      error={error}
      success={success}
    />
  );
}
