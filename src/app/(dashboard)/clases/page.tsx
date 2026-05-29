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

  // Fetch all assessments for this teacher's students.
  // No ponemos .order() por fecha de clase acá porque PostgREST no
  // permite ordenar las filas top-level por una columna de tabla
  // embebida (referencedTable solo ordena filas embebidas dentro de
  // cada fila top-level, no las top-level). Ordenamos en cliente.
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
    .eq("clases.maestra_id", user.id);

  if (error) {
    console.error("Error fetching history:", error);
  }

  // Sort en server por fecha de clase desc, con desempate por
  // respondido_at desc (para que dos clases del mismo día queden
  // ordenadas por la última respondida primero).
  const getFechaClase = (row: any): string => {
    const c = row?.clases;
    if (!c) return "";
    return (Array.isArray(c) ? c[0]?.fecha : c.fecha) ?? "";
  };
  const sorted = ((history as any[]) || []).slice().sort((a, b) => {
    const cmp = getFechaClase(b).localeCompare(getFechaClase(a));
    if (cmp !== 0) return cmp;
    return (b.respondido_at ?? "").localeCompare(a.respondido_at ?? "");
  });

  return (
    <HistorialClient data={sorted} />
  );
}
