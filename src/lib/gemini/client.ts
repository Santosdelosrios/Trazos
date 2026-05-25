// NOTA: este módulo solo debe importarse desde route handlers / server
// components. Importarlo desde un client component infla el bundle
// con el SDK de Gemini (~50kb).
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { buildSystemPrompt, buildUserPrompt, buildHitoPrompt } from "./prompts";
import { parseEjercicios } from "./parser";
import type { Materia, EjercicioGenerado } from "@/lib/types/database";

/**
 * Crea una instancia de GoogleGenerativeAI leyendo la key fresca
 * de process.env en cada llamada. Esto evita problemas de caché
 * con hot-reload en desarrollo.
 */
function getGenAI(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn("⚠️ GEMINI_API_KEY no encontrada. Usando modo MOCK.");
    throw new Error("MOCK_MODE");
  }
  return new GoogleGenerativeAI(key);
}

const EjerciciosResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    ejercicios: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          consigna: { type: SchemaType.STRING },
          tema_evaluado: { type: SchemaType.STRING },
          opciones: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                key: { type: SchemaType.STRING },
                texto: { type: SchemaType.STRING },
              },
              required: ["key", "texto"],
            },
          },
          respuesta_correcta: { type: SchemaType.STRING },
          explicacion: { type: SchemaType.STRING },
        },
        required: ["consigna", "opciones", "respuesta_correcta", "explicacion"],
      },
    },
  },
  required: ["ejercicios"],
};

const HitoResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    nivel_comprension: { type: SchemaType.STRING },
    resumen_ia: { type: SchemaType.STRING },
  },
  required: ["nivel_comprension", "resumen_ia"],
};

/**
 * Genera 3 ejercicios de opción múltiple usando Gemini 2.5 Flash.
 * Solo debe llamarse desde Route Handlers (server-side).
 */
export async function generarEjercicios(
  tema: string,
  nivel: string,
  materia: Materia
): Promise<EjercicioGenerado[]> {
  try {
    const genAI = getGenAI();

    const modelId = "gemini-2.5-flash";
    const fallbackModelId = "gemini-2.5-flash-lite";

    const getModel = (id: string) =>
      genAI.getGenerativeModel({
        model: id,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          responseSchema: EjerciciosResponseSchema,
          // @ts-expect-error - thinkingConfig experimental
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

    let result;
    try {
      const model = getModel(modelId);
      result = await model.generateContent({
        systemInstruction: buildSystemPrompt(nivel, materia),
        contents: [{ role: "user", parts: [{ text: buildUserPrompt(tema) }] }],
      });
    } catch (error: unknown) {
      if ((error as { status?: number })?.status === 503) {
        console.warn(
          `⚠️ ${modelId} saturado (503). Reintentando con ${fallbackModelId}...`
        );
        const fallbackModel = getModel(fallbackModelId);
        result = await fallbackModel.generateContent({
          systemInstruction: buildSystemPrompt(nivel, materia),
          contents: [{ role: "user", parts: [{ text: buildUserPrompt(tema) }] }],
        });
      } else {
        throw error;
      }
    }

    const text = result.response.text();
    console.log("✅ Gemini respondió:", text.substring(0, 100));
    return parseEjercicios(text);
  } catch (error) {
    console.warn("⚠️ Gemini falló. Usando modo MOCK.", error);
    await new Promise((r) => setTimeout(r, 2500));
    return [
      {
        consigna: `Esta es una pregunta simulada sobre ${tema} para nivel ${nivel}. ¿Cuál es la respuesta correcta?`,
        opciones: [
          { key: "a", texto: "Esta es la opción A (Incorrecta)" },
          { key: "b", texto: "Esta es la opción B (Correcta)" },
          { key: "c", texto: "Esta es la opción C (Incorrecta)" },
          { key: "d", texto: "Esta es la opción D (Incorrecta)" },
        ],
        respuesta_correcta: "b",
        explicacion:
          "¡Muy bien! Recordá que esto es un ejercicio simulado porque hubo un error con la API.",
      },
      {
        consigna: `Segunda pregunta simulada sobre ${tema}. ¿Qué opción es correcta?`,
        opciones: [
          { key: "a", texto: "Opción correcta (A)" },
          { key: "b", texto: "Opción incorrecta" },
          { key: "c", texto: "Opción incorrecta" },
          { key: "d", texto: "Opción incorrecta" },
        ],
        respuesta_correcta: "a",
        explicacion: "Perfecto, elegiste la A.",
      },
      {
        consigna: `Tercera pregunta simulada sobre ${tema}.`,
        opciones: [
          { key: "a", texto: "Mal" },
          { key: "b", texto: "Mal" },
          { key: "c", texto: "Bien (C)" },
          { key: "d", texto: "Mal" },
        ],
        respuesta_correcta: "c",
        explicacion: "La correcta era la C.",
      },
    ];
  }
}

/**
 * Genera el resumen del hito analizando la respuesta del alumno y su autoevaluación.
 */
export async function generarResumenHito(
  tema: string,
  respuestaCorrecta: boolean,
  nivelAutoevaluacion: 1 | 2 | 3 | 4
): Promise<{ nivel_comprension: string; resumen_ia: string }> {
  try {
    const genAI = getGenAI();

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        responseSchema: HitoResponseSchema,
        // @ts-expect-error - thinkingConfig experimental
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const userPrompt = `
      Tema: ${tema}
      Respondió correctamente: ${respuestaCorrecta ? "Sí" : "No"}
      Autoevaluación del alumno: ${nivelAutoevaluacion} (1=No entendí, 4=Puedo explicarlo)
    `;

    const result = await model.generateContent({
      systemInstruction: buildHitoPrompt(),
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });

    const text = result.response.text();
    console.log("✅ Gemini hito respondió:", text.substring(0, 100));
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.warn("⚠️ Gemini falló al generar resumen. Usando modo MOCK.", error);
    await new Promise((r) => setTimeout(r, 1500));
    return {
      nivel_comprension: respuestaCorrecta ? "lo_entendio" : "en_proceso",
      resumen_ia: respuestaCorrecta
        ? `¡Excelente! El alumno demostró comprensión del tema "${tema}" y coincide con su autoevaluación. (Resumen Simulado)`
        : `El alumno tuvo dificultades con el tema "${tema}". Se recomienda repasar los conceptos clave la próxima clase. (Resumen Simulado)`,
    };
  }
}

/**
 * Genera el resumen mensual del alumno.
 */
export async function generarResumenMensual(
  alumno: Record<string, unknown>,
  clases: Record<string, unknown>[],
  temas: string[],
  promedio: string | null,
  hitos: Record<string, unknown>[]
): Promise<string> {
  try {
    const genAI = getGenAI();

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
        // @ts-expect-error - thinkingConfig experimental
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const nombre = String(alumno?.nombre || "El alumno");
    const apellido = String(alumno?.apellido || "");
    const nivel = String(alumno?.grado || "No especificado");
    const observacionesHitos =
      (hitos || [])
        .map((h: Record<string, unknown>) => String(h.resumen_ia || ""))
        .slice(0, 5)
        .join(". ") || "Sin hitos específicos registrados";

    const prompt = `Actuá como un/a docente particular con experiencia en pedagogía en Argentina. Tu tarea es redactar un "Informe de Seguimiento Pedagógico Mensual" para los padres/tutores de ${nombre} ${apellido} (${nivel}).

Datos del mes:
- Clases realizadas: ${clases.length}
- Temas trabajados: ${temas.join(", ") || "No hay temas registrados"}
- Promedio de desempeño: ${promedio || "Sin calificaciones"}
- Observaciones de hitos: ${observacionesHitos}

Estructura del informe (redactar en 3 párrafos cortos):
1. Introducción: Resumen general del compromiso y actitud del alumno durante el mes.
2. Desarrollo: Comentario sobre la comprensión de los temas vistos (${temas.slice(0, 3).join(", ")}...) y logros específicos basados en los hitos.
3. Conclusión: Sugerencias breves para reforzar en casa o qué se trabajará el mes siguiente.

Tono: Cálido, alentador pero profesional. Usar español rioplatense sutil (ej: "Santi trabajó muy bien", "notamos un gran avance"). No usar emojis ni formato markdown complejo. Máximo 150 palabras.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.warn(
      "⚠️ Gemini falló al generar reporte mensual. Usando modo MOCK.",
      error
    );
    await new Promise((r) => setTimeout(r, 1500));
    const nombre = String(alumno?.nombre || "El alumno");
    return `Durante este mes, ${nombre} demostró un buen nivel de compromiso en las ${
      clases.length
    } clases realizadas. Trabajamos temas como ${
      temas.slice(0, 2).join(" y ") || "los planificados"
    }, mostrando disposición para aprender.

En general, su comprensión fue favorable, reflejándose en su promedio de ${
      promedio || "desempeño"
    }. Observamos avances en los conceptos más complejos, aunque seguiremos repasando para consolidar la base.

Para el próximo mes, sugiero continuar practicando con los ejercicios en casa para ganar mayor seguridad. ¡Excelente trabajo! (Nota: Este es un reporte simulado porque no se encontró la clave de IA).`;
  }
}

