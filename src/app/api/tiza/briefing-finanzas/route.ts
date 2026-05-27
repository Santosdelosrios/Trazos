import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/plan";
import {
  obtenerContextoBriefing,
  buildPromptBriefing,
  briefingFallback,
  type BriefingFinanzasRespuesta,
  type ContextoBriefingFinanzas,
} from "@/lib/finanzas/briefingFinanzas";

export const runtime = "nodejs";
export const maxDuration = 30;

// ============================================================
// GET /api/tiza/briefing-finanzas
//
// Premium-gated. Devuelve un JSON {saludo, destacado, accion_sugerida}
// generado por Gemini, cacheado 6h por maestra.
//
// Free → 403 con mensaje. La UI muestra preview borroso + CTA upgrade.
// ============================================================

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const plan = await getPlan(supabase, user.id);
  if (plan !== "premium") {
    return NextResponse.json(
      { error: "El briefing de Tiza es una función Premium." },
      { status: 403 }
    );
  }

  // Cache 6h. La key incluye maestra_id + día del año para refrescar
  // automáticamente al cambiar de día y no servir el briefing de ayer.
  const hoy = new Date();
  const cacheKey = `briefing-finanzas:${user.id}:${hoy.getFullYear()}-${hoy.getMonth()}-${hoy.getDate()}`;

  const briefing = await unstable_cache(
    () => generarBriefing(user.id),
    [cacheKey],
    { revalidate: 60 * 60 * 6, tags: [`briefing:${user.id}`] }
  )();

  return NextResponse.json(briefing);
}

async function generarBriefing(maestraId: string): Promise<BriefingFinanzasRespuesta> {
  const supabase = await createClient();
  const ctx = await obtenerContextoBriefing(supabase, maestraId);
  return await llamarGemini(ctx);
}

async function llamarGemini(ctx: ContextoBriefingFinanzas): Promise<BriefingFinanzasRespuesta> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn("[briefing-finanzas] GEMINI_API_KEY no configurada — usando fallback.");
    return briefingFallback(ctx);
  }

  try {
    const genai = new GoogleGenerativeAI(key);
    const model = genai.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 400,
      },
    });
    const result = await model.generateContent(buildPromptBriefing(ctx));
    const text = result.response.text().trim();
    const parsed = JSON.parse(text) as Partial<BriefingFinanzasRespuesta>;

    // Validación minimalista: los 3 campos tienen que ser strings no vacíos.
    if (
      typeof parsed.saludo === "string" && parsed.saludo.trim().length > 0 &&
      typeof parsed.destacado === "string" && parsed.destacado.trim().length > 0 &&
      typeof parsed.accion_sugerida === "string" && parsed.accion_sugerida.trim().length > 0
    ) {
      return {
        saludo: parsed.saludo,
        destacado: parsed.destacado,
        accion_sugerida: parsed.accion_sugerida,
      };
    }
    throw new Error("Respuesta de Gemini incompleta.");
  } catch (err) {
    console.warn("[briefing-finanzas] Gemini falló, usando fallback:", err);
    return briefingFallback(ctx);
  }
}
