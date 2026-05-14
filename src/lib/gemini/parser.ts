// ============================================================
// Parser y validación de respuestas de Gemini
// ============================================================

import { EjerciciosGeneradosSchema } from "@/lib/validations/schemas";
import type { EjercicioGenerado } from "@/lib/types/database";

/**
 * Parsea y valida la respuesta de Gemini para ejercicios.
 * Limpia markdown residual y valida contra el schema Zod.
 *
 * @throws {SyntaxError} Si el JSON es inválido.
 * @throws {ZodError} Si la estructura no cumple el schema.
 */
export function parseEjercicios(raw: string): EjercicioGenerado[] {
  // Gemini a veces envuelve el JSON en bloques de código markdown
  const cleaned = raw
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const parsed: unknown = JSON.parse(cleaned);
  const validData = EjerciciosGeneradosSchema.parse(parsed);
  return validData.ejercicios;
}
