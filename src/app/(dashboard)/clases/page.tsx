import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HistorialClient from "./HistorialClient";

export const metadata = {
  title: "Historial de Clases | Trazos",
};

export default async function ClasesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all assessments for this teacher's students
  const { data: history, error } = await supabase
    .from("clase_alumnos")
    .select(`
      id,
      nota,
      total_correctas,
      respondido_at,
      clase_id,
      clases!inner (
        tema,
        materia,
        fecha,
        maestra_id
      ),
      alumnos!inner (
        nombre,
        apellido
      )
    `)
    .eq("clases.maestra_id", user.id)
    .order("respondido_at", { ascending: false });

  if (error) {
    console.error("Error fetching history:", error);
  }

  return (
    <HistorialClient data={(history as any[]) || []} />
  );
}
