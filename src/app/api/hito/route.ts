import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarResumenHito } from "@/lib/gemini/client";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      clase_alumno_id,
      tema,
      respuestaCorrecta,
      nivelAutoevaluacion,
      resultados_completos,
      nota,
      total_correctas,
      metadata,
    } = body;

    // 1. Generar resumen con Gemini
    const analisisIA = await generarResumenHito(
      tema,
      respuestaCorrecta,
      nivelAutoevaluacion
    );

    const hitoData = {
      clase_alumno_id,
      nivel_comprension: analisisIA.nivel_comprension,
      resumen_ia: analisisIA.resumen_ia,
      metadata: metadata || {},
    };

    // 2. Guardar en Supabase (si hay credenciales configuradas)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = await createClient();

      // 2a. Actualizar clase_alumnos con la nota y resultados
      const { error: updateError } = await supabase
        .from("clase_alumnos")
        .update({
          ejercicios_resultados: resultados_completos,
          nota,
          total_correctas,
          autoevaluacion: nivelAutoevaluacion,
          respondido_at: new Date().toISOString(),
        })
        .eq("id", clase_alumno_id);

      if (updateError) {
        console.error("[API /hito] Error actualizando clase_alumnos:", updateError);
        // Continue anyway to try saving the hito
      }

      // 2b. Crear hito
      const { data, error } = await supabase
        .from("hitos_aprendizaje")
        .insert(hitoData)
        .select()
        .single();

      if (error) {
        console.error("[API /hito] Supabase error:", error);
        // Fallback a devolver el hito sin ID si falla la BD, para que no se rompa la UI
        return NextResponse.json({ hito: { ...hitoData, id: "temp-id" } }, { status: 201 });
      }

      return NextResponse.json({ hito: data }, { status: 201 });
    }

    // MODO DEV: Sin Supabase configurado, devolver datos generados directamente
    return NextResponse.json(
      { hito: { ...hitoData, id: "mock-id-123", created_at: new Date().toISOString() } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API /hito] Error:", error);
    return NextResponse.json(
      { error: "Error interno al generar o guardar el hito." },
      { status: 500 }
    );
  }
}
