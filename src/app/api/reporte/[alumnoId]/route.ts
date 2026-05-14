import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generarResumenMensual } from "@/lib/gemini/client";

export const maxDuration = 60;

/**
 * Genera un resumen con IA del progreso de un alumno en el último mes.
 * Retorna JSON con toda la data necesaria para renderizar el reporte.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ alumnoId: string }> }
) {
  const { alumnoId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Verificar que el alumno pertenece a la maestra
  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, nombre, apellido, grado")
    .eq("id", alumnoId)
    .eq("maestra_id", user.id)
    .single();

  if (!alumno) {
    return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  // Fetch data del último mes
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    { data: maestraData },
    { data: clasesDelMes },
    { data: hitos },
  ] = await Promise.all([
    supabase.from("maestras").select("nombre").eq("id", user.id).single(),

    supabase
      .from("clase_alumnos")
      .select(`
        nota, total_correctas, autoevaluacion, respondido_at,
        clases (tema, materia, fecha)
      `)
      .eq("alumno_id", alumnoId)
      .gte("respondido_at", startOfMonth.toISOString())
      .order("respondido_at", { ascending: true }),

    supabase
      .from("hitos_aprendizaje")
      .select(`
        nivel_comprension, resumen_ia,
        clase_alumnos!inner (alumno_id, clases (fecha, tema))
      `)
      .eq("clase_alumnos.alumno_id", alumnoId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const clases = clasesDelMes || [];
  const notasValidas = clases.map((c: any) => c.nota).filter((n: any) => n !== null);
  const promedio = notasValidas.length > 0
    ? (notasValidas.reduce((a: number, b: number) => a + b, 0) / notasValidas.length).toFixed(1)
    : null;

  const temas = clases.map((c: any) => (c.clases as any)?.tema).filter(Boolean);
  const materias = [...new Set(clases.map((c: any) => (c.clases as any)?.materia).filter(Boolean))];

  // Generar resumen con IA
  const resumenIA = await generarResumenMensual(
    alumno,
    clases,
    temas,
    promedio,
    hitos || []
  );

  return NextResponse.json({
    alumno,
    maestra: maestraData?.nombre || "Maestra",
    fecha: new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
    stats: {
      totalClases: clases.length,
      promedio,
      materias,
      temas,
    },
    clases: clases.map((c: any) => ({
      fecha: (c.clases as any)?.fecha,
      tema: (c.clases as any)?.tema,
      materia: (c.clases as any)?.materia,
      nota: c.nota,
      autoevaluacion: c.autoevaluacion,
    })),
    hitos: (hitos || []).slice(0, 5).map((h: any) => ({
      nivel: h.nivel_comprension,
      resumen: h.resumen_ia,
    })),
    resumenIA,
  });
}
