// ============================================================
// Zod schemas para validación de inputs
// ============================================================

import { z } from "zod";

// ------------------------------------------------------------
// Enums compartidos
// ------------------------------------------------------------

export const MateriaSchema = z.enum([
  "matematica",
  "lengua",
  "cs_naturales",
  "cs_sociales",
  "otro",
  "general",
]);

export const GradoSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(7) as z.ZodType<1 | 2 | 3 | 4 | 5 | 6 | 7>;

export const AutoevaluacionSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(4) as z.ZodType<1 | 2 | 3 | 4>;

// ------------------------------------------------------------
// Schema: Paso 1 — Tema de la clase
// ------------------------------------------------------------

export const PasoTemaSchema = z.object({
  tema: z
    .string()
    .min(3, "El tema debe tener al menos 3 caracteres.")
    .max(200, "El tema no puede superar los 200 caracteres."),
  materia: MateriaSchema,
  grado_target: GradoSchema,
  alumno_ids: z
    .array(z.string().uuid())
    .min(1, "Seleccioná al menos un alumno."),
});

export type PasoTemaInput = z.infer<typeof PasoTemaSchema>;

// ------------------------------------------------------------
// Schema: Respuesta del ejercicio generado por Gemini
// ------------------------------------------------------------

export const OpcionSchema = z.object({
  key: z.enum(["a", "b", "c", "d"]),
  texto: z.string().min(1, "La opción no puede estar vacía."),
});

export const EjercicioGeneradoSchema = z.object({
  consigna: z.string().min(10, "La consigna es demasiado corta."),
  tema_evaluado: z.string().optional(),
  opciones: z.array(OpcionSchema).length(4, "Debe haber exactamente 4 opciones."),
  respuesta_correcta: z.enum(["a", "b", "c", "d"]),
  explicacion: z.string().min(10, "La explicación es demasiado corta."),
});

export const EjerciciosGeneradosSchema = z.object({
  ejercicios: z.array(EjercicioGeneradoSchema).length(3, "Debe haber exactamente 3 ejercicios."),
});

// ------------------------------------------------------------
// Schema: Respuesta del alumno
// ------------------------------------------------------------

export const RespuestaAlumnoSchema = z.object({
  clase_alumno_id: z.string().uuid(),
  respuesta_seleccionada: z.enum(["a", "b", "c", "d"]),
  autoevaluacion: AutoevaluacionSchema,
});
