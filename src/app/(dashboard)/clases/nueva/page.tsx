import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NuevaClaseClient from "./NuevaClaseClient";
import type { AlumnoBasico } from "@/components/cierre-clase/PasoTema";
import { getMateriasForTeacher } from "@/lib/materias";

export const metadata = {
  title: "Nueva Clase | Trazos",
};

export default async function NuevaClasePage({
  searchParams,
}: {
  searchParams: Promise<{ 
    alumnoId?: string;
    agendaId?: string;
    tema?: string;
  }>;
}) {
  const { alumnoId, agendaId, tema } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all data in parallel
  const [
    { data: alumnos, error },
    { data: clasesRecientes },
    agendaResult,
    { data: tarifaData },
  ] = await Promise.all([
    // Dropdown data
    supabase
      .from("alumnos")
      .select("id, nombre, apellido, grado, modelo_cobro, tarifa_override")
      .eq("maestra_id", user.id)
      .order("nombre", { ascending: true }),

    // Frequent topics for suggestions
    supabase
      .from("clases")
      .select("tema")
      .eq("maestra_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),

    // Agenda details (if coming from agenda)
    agendaId
      ? supabase
          .from("agenda")
          .select("tarifa_esperada, duracion_estimada")
          .eq("id", agendaId)
          .single()
      : Promise.resolve({ data: null }),

    // Active global tarifa
    supabase
      .from("tarifas")
      .select("valor_hora")
      .eq("maestra_id", user.id)
      .eq("activa", true)
      .order("vigente_desde", { ascending: false })
      .limit(1),
  ]);

  if (error) {
    console.error("Error fetching alumnos:", error);
  }

  // Compute topic suggestions from recent classes
  const counts: Record<string, number> = {};
  clasesRecientes?.forEach(c => {
    if (c.tema) {
      c.tema.split(",").forEach((t: string) => {
        const cleaned = t.trim();
        if (cleaned.length > 2) counts[cleaned] = (counts[cleaned] || 0) + 1;
      });
    }
  });

  const sugerencias = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tema]) => tema);

  const agendaData = agendaResult?.data;

  return (
    <NuevaClaseClient 
      alumnos={(alumnos as AlumnoBasico[]) || []} 
      initialAlumnoId={alumnoId}
      initialAgendaId={agendaId}
      initialTema={tema}
      initialTarifa={agendaData?.tarifa_esperada ?? tarifaData?.[0]?.valor_hora ?? null}
      initialDuracion={agendaData?.duracion_estimada}
      sugerencias={sugerencias.length > 0 ? sugerencias : undefined}
    />
  );
}
