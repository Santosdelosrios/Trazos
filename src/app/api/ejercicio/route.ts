import { NextResponse } from "next/server";
import { generarEjercicios } from "@/lib/gemini/client";
import { PasoTemaSchema } from "@/lib/validations/schemas";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validar input (solo necesitamos tema, materia y grado para generar)
    const { tema, materia, grado_target } = PasoTemaSchema.pick({
      tema: true,
      materia: true,
      grado_target: true,
    }).parse(body);

    const ejercicios = await generarEjercicios(tema, grado_target, materia);

    return NextResponse.json({ ejercicios }, { status: 200 });
  } catch (error) {
    console.error("[API /ejercicio] Error:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Datos inválidos. Revisá el tema, materia y grado." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "No se pudo generar el ejercicio. Intentá de nuevo." },
      { status: 500 }
    );
  }
}
