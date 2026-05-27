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

export const NivelSchema = z
  .string()
  .min(1, "Indicá el nivel educativo.")
  .max(50, "El nivel no puede superar los 50 caracteres.");

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
  nivel_target: NivelSchema,
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

// ------------------------------------------------------------
// Schemas: Agenda
// ------------------------------------------------------------

export const PlanificarClaseSchema = z.object({
  alumno_id: z.string().uuid("ID de alumno inválido."),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido."),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido."),
  tema_previsto: z.string().max(200, "El tema no puede superar los 200 caracteres.").optional().default(""),
  materia: MateriaSchema,
  tarifa_esperada: z.coerce.number().min(0, "La tarifa no puede ser negativa."),
  duracion_estimada: z.coerce.number().min(0.25, "La duración mínima es 15 min.").max(12, "La duración máxima es 12 horas."),
  repetirSemanal: z.boolean().optional(),
  semanas: z.coerce.number().int().min(2).max(12).optional(),
});

export const ActualizarClaseSchema = z.object({
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido."),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido."),
  alumno_id: z.string().uuid("ID de alumno inválido."),
  tema_previsto: z.string().max(200, "El tema no puede superar los 200 caracteres.").optional().default(""),
});

export const ActualizarHorarioSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido."),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Formato de hora inválido."),
});

export const PlanClaseSchema = z.object({
  objetivo: z.string().max(1000),
  momentos: z
    .array(
      z.object({
        titulo: z.string().max(120),
        minutos: z.coerce.number().min(0).max(600),
        detalle: z.string().max(2000),
      })
    )
    .max(12),
  tarea: z.string().max(2000),
  generado_at: z.string(),
});

export const ActualizarDuracionSchema = z.object({
  duracion_estimada: z.coerce.number().min(0.25, "La duración mínima es 15 min.").max(12, "La duración máxima es 12 horas."),
});

// ------------------------------------------------------------
// Schemas: Alumnos
// ------------------------------------------------------------

export const ModeloCobroSchema = z.enum([
  "por_clase",
  "bolsa_creditos",
  "abono_mensual",
  "cuenta_corriente",
]);

const NOMBRE_REGEX = /^[\p{L}\p{M} '\-]+$/u;

const NombreSchema = z
  .string()
  .min(1, "El nombre es obligatorio.")
  .max(60, "El nombre no puede superar los 60 caracteres.")
  .regex(NOMBRE_REGEX, "El nombre solo puede contener letras, espacios y guiones.");

const ApellidoSchema = z
  .string()
  .min(1, "El apellido es obligatorio.")
  .max(60, "El apellido no puede superar los 60 caracteres.")
  .regex(NOMBRE_REGEX, "El apellido solo puede contener letras, espacios y guiones.");

export const CrearAlumnoSchema = z.object({
  nombre: NombreSchema,
  apellido: ApellidoSchema,
  grado: NivelSchema,
  notas: z.string().max(500, "Las notas no pueden superar los 500 caracteres.").optional(),
});

export const ActualizarAlumnoSchema = z.object({
  nombre: NombreSchema,
  apellido: ApellidoSchema,
  grado: NivelSchema,
  notas: z.string().max(500).optional().nullable(),
  modelo_cobro: ModeloCobroSchema,
  tarifa_override: z.coerce.number().min(0, "La tarifa no puede ser negativa.").nullable().optional(),
  familia_id: z.string().uuid("ID de familia inválido.").nullable().optional(),
  responsable_nombre: z.string().max(120).nullable().optional(),
  responsable_telefono: z.string().max(20).nullable().optional(),
});

export type CrearAlumnoInput = z.infer<typeof CrearAlumnoSchema>;
export type ActualizarAlumnoInput = z.infer<typeof ActualizarAlumnoSchema>;

// ------------------------------------------------------------
// Schemas: Familias (017_familias.sql)
// ------------------------------------------------------------

const NombreFamiliaSchema = z
  .string()
  .min(1, "El nombre de la familia es obligatorio.")
  .max(120, "El nombre no puede superar los 120 caracteres.");

const TelefonoSchema = z
  .string()
  .max(20, "El teléfono no puede superar los 20 caracteres.")
  .refine(
    (v) => v.replace(/\D/g, "").length === 0 || v.replace(/\D/g, "").length >= 8,
    "El teléfono parece incompleto."
  );

export const GuardarFamiliaSchema = z.object({
  nombre: NombreFamiliaSchema,
  responsable_nombre: z.string().max(120).optional().nullable(),
  responsable_telefono: TelefonoSchema.optional().nullable(),
  datos_pago_override: z.string().max(500).optional().nullable(),
  notas: z.string().max(500).optional().nullable(),
});

export const AsignarFamiliaSchema = z.object({
  alumno_id: z.string().uuid("ID de alumno inválido."),
  familia_id: z.string().uuid("ID de familia inválido.").nullable(),
});

export type GuardarFamiliaInput = z.infer<typeof GuardarFamiliaSchema>;
export type AsignarFamiliaInput = z.infer<typeof AsignarFamiliaSchema>;

// ------------------------------------------------------------
// Schemas: Finanzas
// ------------------------------------------------------------

export const EstadoPagoSchema = z.enum(["pendiente", "pagado", "parcial"]);

export const CategoriaGastoSchema = z.enum([
  "viatico",
  "material",
  "plataforma",
  "impuesto",
  "otro",
]);

const MontoSchema = z.coerce
  .number()
  .positive("El monto debe ser mayor a 0.")
  .max(10_000_000, "El monto excede el límite permitido.");

export const RegistrarPagoSchema = z.object({
  alumno_id: z.string().uuid("ID de alumno inválido."),
  monto: MontoSchema,
  estado: EstadoPagoSchema,
  fecha_pago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nota: z.string().max(300).optional(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "Formato de período inválido (YYYY-MM).").optional(),
});

export const CargarCreditosSchema = z.object({
  alumno_id: z.string().uuid("ID de alumno inválido."),
  creditos: z.coerce.number().int().min(1, "Mínimo 1 crédito.").max(100, "Máximo 100 créditos."),
  monto: MontoSchema,
  nota: z.string().max(300).optional(),
});

export const RegistrarPagoCuentaCorrienteSchema = z.object({
  alumno_id: z.string().uuid("ID de alumno inválido."),
  monto: MontoSchema,
  nota: z.string().max(300).optional(),
});

export const RegistrarGastoSchema = z.object({
  /** Enum legacy. Durante el rollout PR-6 sigue siendo required y se
   *  deriva de categoria_id si solo viene este último. */
  categoria: CategoriaGastoSchema,
  /** PR-6: nueva FK a categorias_gasto_custom. Opcional por backcompat. */
  categoria_id: z.string().uuid("ID de categoría inválido.").optional().nullable(),
  descripcion: z.string().max(200).optional(),
  monto: MontoSchema,
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido."),
  recurrente: z.boolean().optional().default(false),
});

export const GuardarCategoriaGastoSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio.")
    .max(60, "El nombre no puede superar los 60 caracteres."),
  icono: z.string().max(40).optional().nullable(),
});

export type GuardarCategoriaGastoInput = z.infer<typeof GuardarCategoriaGastoSchema>;

export const GuardarTarifaSchema = z.object({
  valor_hora: z.coerce
    .number()
    .positive("La tarifa debe ser mayor a 0.")
    .max(10_000_000, "Tarifa excesivamente alta."),
});

export const MedioPagoSchema = z.enum([
  "efectivo",
  "transferencia",
  "mercadopago",
  "otro",
]);

/** Confirmación de un cobro (PR-3): exige medio de pago + fecha. */
export const ConfirmarPagoSchema = z.object({
  pago_id: z.string().uuid("ID de cobro inválido."),
  monto: MontoSchema,
  estado: z.enum(["pagado", "parcial"]),  // confirmar nunca deja pendiente
  medio_pago: MedioPagoSchema,
  fecha_pago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido."),
  comprobante_url: z.string().max(500).optional(),
  nota: z.string().max(300).optional(),
});

export type RegistrarPagoInput = z.infer<typeof RegistrarPagoSchema>;
export type CargarCreditosInput = z.infer<typeof CargarCreditosSchema>;
export type RegistrarGastoInput = z.infer<typeof RegistrarGastoSchema>;
export type GuardarTarifaInput = z.infer<typeof GuardarTarifaSchema>;

// ------------------------------------------------------------
// Schemas: Perfil
// ------------------------------------------------------------

export const ActualizarPerfilSchema = z.object({
  nombre: NombreSchema,
});

export type ActualizarPerfilInput = z.infer<typeof ActualizarPerfilSchema>;
