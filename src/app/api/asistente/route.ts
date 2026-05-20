// ============================================================
// Route Handler: POST /api/asistente
// Agente conversacional "Tiza" con Function Calling loop
// Solo accesible para usuarios Premium.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/plan";
import { GoogleGenerativeAI, type FunctionDeclaration } from "@google/generative-ai";
import { NextResponse } from "next/server";

import { buildAsistenteSystemPrompt } from "@/lib/asistente/system-prompt";
import { TOOL_DECLARATIONS } from "@/lib/asistente/tools";
import { executeTool } from "@/lib/asistente/executor";
import type { ActionTaken, AsistenteRequest, GeminiHistoryEntry } from "@/lib/asistente/types";

// Edge runtime: cold start ~50ms vs ~1s en Node. La autenticación
// (Supabase via @supabase/ssr) y Gemini (fetch nativo) son edge-compatible.
export const runtime = "edge";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Máximo de iteraciones del loop de function calling (seguridad)
const MAX_TOOL_ITERATIONS = 8;

// Ventana de contexto: últimos N turnos enviados a Gemini.
// Cada "turno" en el historial es 1 entry (user o model). 20 entries ≈ 10 intercambios.
const HISTORY_WINDOW = 20;

/**
 * Trimea el historial al final manteniendo coherencia:
 * - Empieza siempre en un turno "user" (Gemini lo requiere)
 * - No corta a mitad de un par function_call/function_response
 */
function trimHistory(history: GeminiHistoryEntry[]): GeminiHistoryEntry[] {
  if (history.length <= HISTORY_WINDOW) return history;

  const trimmed = history.slice(-HISTORY_WINDOW);

  // Avanzar hasta encontrar el primer turno "user" (Gemini exige que el
  // historial empiece con user, no model)
  while (trimmed.length > 0 && trimmed[0].role !== "user") {
    trimmed.shift();
  }

  return trimmed;
}

function getGenAI(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");
  return new GoogleGenerativeAI(key);
}

export async function POST(request: Request) {
  // Parseamos el body en paralelo con la autenticación
  const supabase = await createClient();
  const [authResult, bodyResult] = await Promise.allSettled([
    supabase.auth.getUser(),
    request.json() as Promise<AsistenteRequest>,
  ]);

  if (authResult.status !== "fulfilled" || !authResult.value.data.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const user = authResult.value.data.user;

  if (bodyResult.status !== "fulfilled") {
    return NextResponse.json({ error: "Request inválido" }, { status: 400 });
  }
  const { message, history = [] } = bodyResult.value;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  // Verificar Premium (paralelizado conceptualmente con el resto del setup)
  const plan = await getPlan(supabase, user.id);
  if (plan !== "premium") {
    return NextResponse.json(
      { error: "Tiza está disponible solo para usuarios Premium ✨" },
      { status: 403 }
    );
  }

  // Ventana de contexto: solo últimos N turnos para que el payload no crezca
  // linealmente con la conversación.
  const trimmedHistory = trimHistory(history);

  // Construcción del SSE stream. Cada línea es un evento JSON.
  // Eventos:
  //   { type: "action", action: ActionTaken }   → tool ejecutado
  //   { type: "token", text: string }            → chunk de texto
  //   { type: "done", history, actions }         → cierre normal
  //   { type: "error", reply, history, actions } → cierre con error
  const encoder = new TextEncoder();
  const sse = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      const actionsTaken: ActionTaken[] = [];

      const close = (eventType: "done" | "error", extra: Record<string, unknown>) => {
        try {
          controller.enqueue(sse({ type: eventType, actions: actionsTaken, ...extra }));
        } catch {
          // ignore
        }
        controller.close();
      };

      try {
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({
          model: "gemini-3.5-flash",
          systemInstruction: buildAsistenteSystemPrompt(),
          tools: [{ functionDeclarations: TOOL_DECLARATIONS as unknown as FunctionDeclaration[] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        });

        const chat = model.startChat({
          history: trimmedHistory.length > 0 ? trimmedHistory : undefined,
        });

        // Estrategia híbrida:
        // - Primer turno: sendMessageStream (token-by-token streaming si no hay tools)
        // - Iteraciones con tool responses: sendMessage (non-stream) por estabilidad
        //   del SDK con function response submission
        // - Texto final tras tools: emitido como un único evento "token"
        type FunctionResponsePart = { functionResponse: { name: string; response: unknown } };
        let totalTextEmitted = "";

        // PASO 1: primer mensaje con streaming
        const { stream: firstStream, response: firstResponsePromise } = await chat.sendMessageStream(message);

        for await (const chunk of firstStream) {
          const text = chunk.text();
          if (text) {
            totalTextEmitted += text;
            controller.enqueue(sse({ type: "token", text }));
          }
        }

        let lastResponse = await firstResponsePromise;
        let calls = lastResponse.functionCalls();
        let iterations = 0;

        // PASO 2: si hubo function calls, loop con sendMessage (non-stream)
        while (calls && calls.length > 0 && iterations < MAX_TOOL_ITERATIONS) {
          const responses: FunctionResponsePart[] = [];
          for (const call of calls) {
            const toolResult = await executeTool(
              call.name,
              call.args as Record<string, unknown>,
              supabase,
              user.id
            );

            const action: ActionTaken = {
              tool: call.name,
              summary: toolResult.summary,
              success: toolResult.success,
            };
            actionsTaken.push(action);
            controller.enqueue(sse({ type: "action", action }));

            responses.push({
              functionResponse: { name: call.name, response: toolResult.data },
            });
          }

          // sendMessage (non-stream): más estable que sendMessageStream para
          // function response submission. La respuesta llega completa de una.
          const next = await chat.sendMessage(
            responses as unknown as Parameters<typeof chat.sendMessage>[0]
          );
          lastResponse = next.response;

          // Emitir el texto de esta iteración (si lo hay) como un único token
          let chunkText = "";
          try {
            chunkText = lastResponse.text();
          } catch {
            chunkText = "";
          }
          if (chunkText) {
            totalTextEmitted += chunkText;
            controller.enqueue(sse({ type: "token", text: chunkText }));
          }

          calls = lastResponse.functionCalls();
          iterations++;
        }

        const updatedHistory = await chat.getHistory();

        // Fallback: si no salió ningún texto
        if (!totalTextEmitted) {
          const fallback =
            iterations >= MAX_TOOL_ITERATIONS
              ? "Hice varias cosas, pero el proceso fue largo. Por favor revisá si todo quedó bien 😅"
              : "Listo. ¿Te ayudo con algo más?";
          controller.enqueue(sse({ type: "token", text: fallback }));
        }

        close("done", { history: updatedHistory });
      } catch (error: unknown) {
        // Logging detallado para diagnosticar errores de Gemini
        const errMsg = error instanceof Error ? error.message : String(error);
        const errStack = error instanceof Error ? error.stack : undefined;
        console.error("❌ Error en agente Tiza:", { message: errMsg, stack: errStack });

        // En dev incluimos el mensaje real para diagnosticar
        const isDev = process.env.NODE_ENV !== "production";
        const replyText = isDev
          ? `Error técnico: ${errMsg}`
          : "Uy, tuve un problema técnico 😅 Intentá de nuevo en un ratito, ¿dale?";

        close("error", {
          reply: replyText,
          history,
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // deshabilita buffering en proxies
    },
  });
}
