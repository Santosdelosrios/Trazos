import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AgendaClient from "./AgendaClient";
import type { AgendaItem, Materia } from "@/lib/types/database";

export interface ClaseCerrada {
  id: string;
  tema: string;
  materia: Materia;
  fecha: string;
  alumno?: { nombre: string; apellido: string };
  pago?: { id: string; estado: string; monto: number };
}

export const metadata = {
  title: "Agenda | Trazos",
};

export default async function AgendaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all data in parallel for maximum speed
  const [
    { data: agenda, error },
    { data: alumnos },
    { data: tarifaData },
    { data: clasesCerradasRaw },
    { data: maestraData },
  ] = await Promise.all([
    // Agenda items with student details
    supabase
      .from("agenda")
      .select(`
        *,
        alumnos (
          id,
          nombre,
          apellido,
          grado
        )
      `)
      .eq("maestra_id", user.id)
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true }),

    // Alumnos for the "Planificar" modal
    supabase
      .from("alumnos")
      .select("id, nombre, apellido, grado")
      .order("nombre", { ascending: true }),

    // Tarifa activa
    supabase
      .from("tarifas")
      .select("valor_hora")
      .eq("maestra_id", user.id)
      .eq("activa", true)
      .order("vigente_desde", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Clases cerradas con pagos
    supabase
      .from("clases")
      .select(`
        id,
        tema,
        materia,
        fecha,
        clase_alumnos (
          alumnos (id, nombre, apellido)
        ),
        pagos (id, estado, monto)
      `)
      .eq("maestra_id", user.id)
      .order("fecha", { ascending: false })
      .limit(15),

    // Maestra info para Premium Calendar Sync
    supabase
      .from("maestras")
      .select("plan, calendar_token")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const clasesCerradas: ClaseCerrada[] = (clasesCerradasRaw || []).map((c: any) => ({
    id: c.id,
    tema: c.tema,
    materia: c.materia,
    fecha: c.fecha,
    alumno: c.clase_alumnos?.[0]?.alumnos,
    pago: c.pagos?.[0]
  }));

  return (
    <AgendaClient 
      initialAgenda={(agenda as AgendaItem[]) || []} 
      alumnos={alumnos || []} 
      tarifaActual={tarifaData?.valor_hora || null}
      clasesCerradas={clasesCerradas}
      plan={(maestraData?.plan as "free" | "premium") || "free"}
      calendarToken={maestraData?.calendar_token || null}
    />
  );
}
