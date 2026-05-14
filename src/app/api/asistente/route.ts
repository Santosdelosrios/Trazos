// ============================================================
// Route Handler: POST /api/asistente
// Agente conversacional "Tiza" con Function Calling loop
// Solo accesible para usuarios Premium.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/plan";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

import { buildAsistenteSystemPrompt } from "@/lib/asistente/system-prompt";
import { TOOL_DECLARATIONS } from "@/lib/asistente/tools";
import { executeTool } from "@/lib/asistente/executor";
import type { ActionTaken, AsistenteRequest } from "@/lib/asistente/types";

export const maxDuration = 60;

// Máximo de iteraciones del loop de function calling (seguridad)
const MAX_TOOL_ITERATIONS = 8;

function getGenAI(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");
  return new GoogleGenerativeAI(key);
}

export async function POST(request: Request) {
  // 1. Autenticar
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // 2. Verificar Premium
  const plan = await getPlan(supabase, user.id);
  if (plan !== "premium") {
    return NextResponse.json(
      { error: "Tiza está disponible solo para usuarios Premium ✨" },
      { status: 403 }
    );
  }

  // 3. Parsear request
  let body: AsistenteRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request inválido" }, { status: 400 });
  }

  const { message, history = [] } = body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  try {
    // 4. Iniciar modelo con tools
    const genAI = getGenAI();
    
    // Obtener feriados para el prompt
    const { getFeriados, formatFeriadoDate } = await import("@/lib/utils/feriados");
    const feriadosRaw = await getFeriados(new Date().getFullYear());
    const feriadosList = feriadosRaw.map(f => `${formatFeriadoDate(f, new Date().getFullYear())}: ${f.motivo} (${f.tipo})`);

    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite", // Usando Gemini 3.1 Flash Lite (15 RPM)
      systemInstruction: buildAsistenteSystemPrompt(feriadosList),
      tools: [{ functionDeclarations: TOOL_DECLARATIONS as any }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    // 5. Iniciar chat con historial previo
    const chat = model.startChat({
      history: history.length > 0 ? history : undefined,
    });

    // 6. Enviar mensaje del usuario
    let result = await chat.sendMessage(message);
    const actionsTaken: ActionTaken[] = [];

    // 7. Loop de function calling
    let iterations = 0;
    while (iterations < MAX_TOOL_ITERATIONS) {
      const calls = result.response.functionCalls();
      if (!calls || calls.length === 0) break;

      console.log(`🔧 Tiza ejecutando ${calls.length} tool(s) — iteración ${iterations + 1}`);

      const responses = [];
      for (const call of calls) {
        console.log(`  → ${call.name}(${JSON.stringify(call.args)})`);

        const toolResult = await executeTool(
          call.name,
          call.args as Record<string, unknown>,
          supabase,
          user.id
        );

        actionsTaken.push({
          tool: call.name,
          summary: toolResult.summary,
          success: toolResult.success,
        });

        responses.push({
          functionResponse: {
            name: call.name,
            response: toolResult.data,
          },
        });
      }

      // Enviar resultados de vuelta a Gemini
      result = await chat.sendMessage(responses);
      iterations++;
    }

    // 8. Obtener historial actualizado
    const updatedHistory = await chat.getHistory();

    // 9. Retornar respuesta
    let replyText = "";
    try {
      replyText = result.response.text();
    } catch (e) {
      if (iterations >= MAX_TOOL_ITERATIONS) {
        replyText = "Hice varias cosas, pero el proceso fue largo. Por favor revisá si todo quedó bien 😅";
      } else {
        replyText = "Listo. ¿Te ayudo con algo más?";
      }
    }

    return NextResponse.json({
      reply: replyText,
      history: updatedHistory,
      actions: actionsTaken,
    });
  } catch (error: any) {
    console.error("❌ Error en agente Tiza:", error);
    return NextResponse.json(
      {
        reply:
          "Uy, tuve un problema técnico 😅 Intentá de nuevo en un ratito, ¿dale?",
        history,
        actions: [],
      },
      { status: 500 }
    );
  }
}
