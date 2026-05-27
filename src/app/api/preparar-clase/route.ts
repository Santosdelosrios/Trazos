import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/plan";
import { prepararPlanClase } from "@/lib/gemini/client";
import type { Materia, NivelComprension } from "@/lib/types/database";

export const maxDuration = 60;

const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15MB: límite seguro para inlineData

const NIVEL_LABELS: Record<NivelComprension, string> = {
  no_entendio: "No entendió",
  en_proceso: "En proceso",
  lo_entendio: "Lo entendió",
  puede_explicarlo: "Puede explicarlo",
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const plan = await getPlan(supabase, user.id);
    if (plan !== "premium") {
      return NextResponse.json(
        { error: "Preparar la clase con Tiza es una función Premium." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const agendaId = formData.get("agendaId");
    const file = formData.get("file");

    if (typeof agendaId !== "string" || !agendaId) {
      return NextResponse.json({ error: "Falta la clase a preparar." }, { status: 400 });
    }
    // PDF es opcional — si no se sube, Tiza trabaja solo con el contexto del alumno.
    let pdfFile: File | null = null;
    if (file instanceof File) {
      if (file.type !== "application/pdf") {
        return NextResponse.json({ error: "El archivo debe ser un PDF." }, { status: 400 });
      }
      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json(
          { error: "El PDF es muy grande (máximo 15MB)." },
          { status: 400 }
        );
      }
      pdfFile = file;
    }

    // Cargar la clase de la agenda (verifica ownership) + datos del alumno
    const { data: agenda, error: agendaError } = await supabase
      .from("agenda")
      .select("id, alumno_id, tema_previsto, materia, duracion_estimada, alumnos(nombre, apellido, grado)")
      .eq("id", agendaId)
      .eq("maestra_id", user.id)
      .single();

    if (agendaError || !agenda) {
      return NextResponse.json({ error: "Clase no encontrada." }, { status: 404 });
    }

    // alumnos.grado es text libre desde la migración 010_nivel_educativo
    // (puede ser "3° grado", "2° año secundaria", "Universitario", etc.).
    // Lo usamos tal cual viene; antes lo envolvíamos en `${grado}° grado`
    // y para alumnos no-primarios quedaba "Universitario° grado".
    const alumno = agenda.alumnos as unknown as
      | { nombre: string; apellido: string; grado: string | null }
      | null;
    const nombreAlumno = alumno
      ? `${alumno.nombre} ${alumno.apellido}`.trim()
      : "el alumno";
    const grado = alumno?.grado?.trim() || "No especificado";

    // Historial de hitos del alumno (lo que distingue el plan de uno genérico)
    const { data: hitos } = await supabase
      .from("hitos_aprendizaje")
      .select("nivel_comprension, resumen_ia, created_at, clase_alumnos!inner(alumno_id, clases!inner(tema, maestra_id))")
      .eq("clase_alumnos.alumno_id", agenda.alumno_id)
      .eq("clase_alumnos.clases.maestra_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    const historial =
      hitos && hitos.length > 0
        ? hitos
            .map((h) => {
              const tema =
                (h.clase_alumnos as unknown as { clases?: { tema?: string } })?.clases
                  ?.tema || "tema previo";
              const nivel =
                NIVEL_LABELS[h.nivel_comprension as NivelComprension] ||
                h.nivel_comprension;
              return `- ${tema}: ${nivel}. ${h.resumen_ia || ""}`.trim();
            })
            .join("\n")
        : "Sin hitos previos registrados para este alumno.";

    const duracionMin = Math.round((agenda.duracion_estimada || 1) * 60);

    const pdfBase64 = pdfFile
      ? Buffer.from(await pdfFile.arrayBuffer()).toString("base64")
      : null;

    const planClase = await prepararPlanClase(pdfBase64, {
      alumno: nombreAlumno,
      grado,
      materia: agenda.materia as Materia,
      tema: agenda.tema_previsto || "",
      duracionMin,
      historial,
    });

    // El PDF es efímero: solo persiste el plan generado.
    const { error: updateError } = await supabase
      .from("agenda")
      .update({ plan_clase: planClase })
      .eq("id", agendaId)
      .eq("maestra_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "No se pudo guardar el plan." },
        { status: 500 }
      );
    }

    return NextResponse.json({ plan: planClase }, { status: 200 });
  } catch (error) {
    console.error("[API /preparar-clase] Error:", error);
    return NextResponse.json(
      { error: "No se pudo preparar la clase. Intentá de nuevo." },
      { status: 500 }
    );
  }
}
