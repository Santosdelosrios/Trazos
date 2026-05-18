// ============================================================
// Tipos del dominio — Cierre de Clase MVP
// Reflejan el schema SQL de 001_initial_schema.sql
// ============================================================

export type Materia =
  | "matematica"
  | "lengua"
  | "cs_naturales"
  | "cs_sociales"
  | "otro"
  | "general";

export type NivelComprension =
  | "no_entendio"
  | "en_proceso"
  | "lo_entendio"
  | "puede_explicarlo";

export type Nivel = string;

export type Autoevaluacion = 1 | 2 | 3 | 4;

// ------------------------------------------------------------
// Entidades principales
// ------------------------------------------------------------

export interface Maestra {
  id: string;
  nombre: string;
  email: string;
  telefono?: string | null;
  plan: "free" | "premium";
  calendar_token?: string;
  created_at: string;
}

export interface Alumno {
  id: string;
  maestra_id: string;
  nombre: string;
  apellido: string;
  grado: Nivel;
  notas?: string | null;
  created_at: string;
}

export interface Clase {
  id: string;
  maestra_id: string;
  tema: string;
  materia: Materia;
  grado_target: Nivel;
  ejercicio_generado: EjercicioGenerado | null;
  fecha: string;
  duracion_real?: number;
  created_at: string;
}

export interface ClaseAlumno {
  id: string;
  clase_id: string;
  alumno_id: string;
  respuesta_seleccionada: string | null;
  respuesta_correcta: boolean | null;
  autoevaluacion: Autoevaluacion | null;
  respondido_at: string | null;
  ejercicios_resultados: EjercicioResultado[];
  nota: number | null;
  total_correctas: number;
}

export interface HitoAprendizaje {
  id: string;
  clase_alumno_id: string;
  nivel_comprension: NivelComprension;
  resumen_ia: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgendaItem {
  id: string;
  maestra_id: string;
  alumno_id: string;
  fecha: string;
  hora: string;
  tema_previsto: string | null;
  materia: Materia;
  estado: "pendiente" | "completada" | "cancelada";
  tarifa_esperada?: number | null;
  duracion_estimada?: number;
  clase_id?: string | null;
  created_at: string;
  // Join fields
  alumnos?: Alumno;
}

// ------------------------------------------------------------
// Entidades financieras (005_finanzas.sql)
// ------------------------------------------------------------

export type CategoriaGasto =
  | "viatico"
  | "material"
  | "plataforma"
  | "impuesto"
  | "otro";

export type EstadoPago = "pendiente" | "pagado" | "parcial" | "cancelado";

export interface Tarifa {
  id: string;
  maestra_id: string;
  valor_hora: number;
  vigente_desde: string;
  activa: boolean;
  notas?: string | null;
  created_at: string;
}

export interface Gasto {
  id: string;
  maestra_id: string;
  categoria: CategoriaGasto;
  descripcion?: string | null;
  monto: number;
  fecha: string;
  recurrente: boolean;
  created_at: string;
}

export interface Pago {
  id: string;
  maestra_id: string;
  alumno_id: string;
  clase_id?: string | null;
  monto: number;
  estado: EstadoPago;
  fecha_pago?: string | null;
  nota?: string | null;
  created_at: string;
  // Join fields
  alumnos?: Alumno;
}

export interface ResumenFinancieroMes {
  ingresos_mes: number;
  gastos_mes: number;
  ganancia_neta: number;
  pagos_pendientes: number;
}

export interface SaldoAlumno {
  clases_dictadas: number;
  total_facturado: number;
  total_cobrado: number;
  saldo_pendiente: number;
}

export interface MetricasNegocio {
  horas_mes: number;
  alumno_estrella: string;
  materia_top: string;
}

// ------------------------------------------------------------
// Tipos de la IA (respuesta de Gemini)
// ------------------------------------------------------------

export interface OpcionMultiple {
  key: "a" | "b" | "c" | "d";
  texto: string;
}

/** Estructura que retorna Gemini, parseada y validada con Zod */
export interface EjercicioGenerado {
  consigna: string;
  tema_evaluado?: string;
  opciones: OpcionMultiple[];
  respuesta_correcta: "a" | "b" | "c" | "d";
  explicacion: string;
}

/** Resultado de un ejercicio individual respondido por el alumno */
export interface EjercicioResultado {
  numero: number;
  consigna: string;
  respuesta_alumno: string;
  respuesta_correcta: string;
  es_correcta: boolean;
}

/** Datos de la evaluación completa (3 ejercicios + autoevaluación) */
export interface EvaluacionCompleta {
  ejercicios: EjercicioGenerado[];
  resultados: EjercicioResultado[];
  autoevaluacion: Autoevaluacion;
  nota: number;
  total_correctas: number;
}

// ------------------------------------------------------------
// Constantes de UI para mapear valores del dominio
// ------------------------------------------------------------

export const MATERIA_LABELS: Record<Materia, string> = {
  matematica: "Matemática",
  lengua: "Lengua y Literatura",
  cs_naturales: "Ciencias Naturales",
  cs_sociales: "Ciencias Sociales",
  otro: "Otro",
  general: "General",
};

export const MATERIA_ICONS: Record<Materia, string> = {
  matematica: "",
  lengua: "",
  cs_naturales: "",
  cs_sociales: "",
  otro: "",
  general: "",
};

/** Sugerencias de niveles para el selector */
export const NIVEL_SUGERENCIAS: string[] = [
  "1° grado",
  "2° grado",
  "3° grado",
  "4° grado",
  "5° grado",
  "6° grado",
  "7° grado",
  "1° año secundaria",
  "2° año secundaria",
  "3° año secundaria",
  "4° año secundaria",
  "5° año secundaria",
  "6° año secundaria",
  "Nivel inicial",
  "Universitario",
  "Adultos",
  "Sesión psicopedagógica",
];

export const AUTOEVALUACION_CONFIG: Record<
  Autoevaluacion,
  { emoji: string; label: string; color: string }
> = {
  1: { emoji: "", label: "No entendí", color: "#ef4444" },
  2: { emoji: "", label: "Más o menos", color: "#f59e0b" },
  3: { emoji: "", label: "Lo entendí", color: "#22c55e" },
  4: { emoji: "", label: "Puedo explicarlo", color: "#8b5cf6" },
};

export const CATEGORIA_GASTO_LABELS: Record<CategoriaGasto, string> = {
  viatico: "Viático",
  material: "Material",
  plataforma: "Plataforma",
  impuesto: "Impuesto",
  otro: "Otro",
};

export const CATEGORIA_GASTO_ICONS: Record<CategoriaGasto, string> = {
  viatico: "",
  material: "",
  plataforma: "",
  impuesto: "",
  otro: "",
};

export const ESTADO_PAGO_CONFIG: Record<
  EstadoPago,
  { label: string; color: string; bg: string }
> = {
  pendiente: { label: "Pendiente", color: "text-warning-500", bg: "bg-warning-50" },
  pagado: { label: "Pagado", color: "text-success-500", bg: "bg-success-50" },
  parcial: { label: "Parcial", color: "text-accent-600", bg: "bg-accent-50" },
  cancelado: { label: "Cancelado", color: "text-surface-400", bg: "bg-surface-100" },
};
