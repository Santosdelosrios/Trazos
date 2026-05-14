import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HitosClient from "./HitosClient";

export const metadata = {
  title: "Hitos de Aprendizaje | Trazos",
};

export default async function HitosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch hitos and alumnos in parallel
  const [
    { data: hitos, error },
    { data: alumnos },
  ] = await Promise.all([
    supabase
      .from("hitos_aprendizaje")
      .select(`
        id,
        nivel_comprension,
        resumen_ia,
        created_at,
        clase_alumnos!inner (
          alumnos!inner (
            id,
            nombre,
            apellido
          ),
          clases!inner (
            tema,
            materia,
            maestra_id
          )
        )
      `)
      .eq("clase_alumnos.clases.maestra_id", user.id)
      .order("created_at", { ascending: false }),

    // Fetch unique alumnos for the filter
    supabase
      .from("alumnos")
      .select("id, nombre, apellido")
      .order("nombre", { ascending: true }),
  ]);

  if (error) {
    console.error("Error fetching hitos:", error);
  }

  return (
    <HitosClient 
      data={(hitos as any[]) || []} 
      alumnos={alumnos || []}
    />
  );
}
