// ============================================================
// templateWhatsApp.ts — Engine de plantillas editables
//
// Variables disponibles en el template:
//   {nombre_alumno}      → "Sofía Pérez"
//   {nombre_responsable} → "Mariana" (o nombre del alumno si no hay)
//   {mes}                → "mayo"
//   {detalle_clases}     → bloque multi-línea con fecha + materia + monto
//   {detalle_por_alumno} → bloque agrupado por alumno (solo familias)
//   {cantidad_clases}    → "5"
//   {monto}              → "$ 12.500"
//   {datos_pago}         → texto libre de la maestra (CBU/alias/MP)
//
// Reglas:
//   - Si una variable no tiene dato, se reemplaza por string vacío
//     (no se deja el {placeholder} crudo).
//   - Si el template es null/vacío, el caller usa el default que vive
//     en plantillasWhatsApp.ts.
//   - Si la maestra escribió variables que no existen, se dejan crudas
//     para que pueda verlo en el preview y corregir.
// ============================================================

import { formatearMonto } from "./formatearMonto";

/** Nombres canónicos de las variables soportadas. */
export const VARIABLES_TEMPLATE = [
  "nombre_alumno",
  "nombre_responsable",
  "mes",
  "detalle_clases",
  "detalle_por_alumno",
  "cantidad_clases",
  "monto",
  "datos_pago",
] as const;

export type VariableTemplate = (typeof VARIABLES_TEMPLATE)[number];

export type VarsTemplate = Partial<Record<VariableTemplate, string | number>>;

const VARIABLE_SET = new Set<string>(VARIABLES_TEMPLATE);

/**
 * Renderiza un template reemplazando {variable} por su valor.
 * - Si la variable existe en vars pero el valor es vacío/null, se
 *   reemplaza por "".
 * - Si la variable está en VARIABLES_TEMPLATE pero no en vars, se
 *   reemplaza por "" (tratamiento uniforme con el caso anterior).
 * - Si el placeholder no es una variable conocida, se deja crudo
 *   para que la maestra vea el typo y lo corrija.
 */
export function renderTemplate(template: string, vars: VarsTemplate): string {
  return template.replace(/\{([a-z_][a-z0-9_]*)\}/gi, (match, name: string) => {
    if (!VARIABLE_SET.has(name)) return match;
    const valor = vars[name as VariableTemplate];
    if (valor == null) return "";
    return String(valor);
  });
}

// ============================================================
// Builder de variables
// ============================================================

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export interface ClaseParaDetalle {
  fecha: string;          // YYYY-MM-DD o ISO
  tema?: string | null;
  monto: number;
  /** Para detalle_por_alumno: nombre del alumno al que pertenece la clase */
  nombre_alumno?: string;
}

export interface BuildVarsInput {
  /** Nombre completo del alumno destinatario del cobro. */
  nombre_alumno?: string | null;
  /** Nombre del responsable (familia → alumno → nombre_alumno como fallback). */
  nombre_responsable?: string | null;
  /** Período de referencia. Si no se pasa, usa el mes actual. */
  fecha_referencia?: Date;
  /** Lista de clases (para detalle_clases). */
  clases?: ClaseParaDetalle[];
  /** Monto total a cobrar. */
  monto: number;
  /** Datos de pago de la maestra (CBU/alias/MP). */
  datos_pago?: string | null;
  /** Si se llena, arma {detalle_por_alumno} agrupado. */
  miembros_familia?: Array<{ nombre_completo: string; subtotal: number; clases: number }>;
}

export function buildVars(input: BuildVarsInput): VarsTemplate {
  const fecha = input.fecha_referencia ?? new Date();
  const mesNombre = MESES_ES[fecha.getMonth()];

  const detalleClases = (input.clases ?? [])
    .map((c) => {
      const fechaCorta = formatFechaCorta(c.fecha);
      const tema = c.tema ? ` · ${c.tema}` : "";
      return `• ${fechaCorta}${tema} — ${formatearMonto(c.monto)}`;
    })
    .join("\n");

  const detallePorAlumno = (input.miembros_familia ?? [])
    .filter((m) => m.subtotal > 0)
    .map((m) =>
      `• ${m.nombre_completo}: ${m.clases} ${m.clases === 1 ? "clase" : "clases"} — ${formatearMonto(m.subtotal)}`
    )
    .join("\n");

  // Truco de formato: el responsable lleva un espacio prefijado cuando
  // existe ("¡Hola Mariana!") y queda vacío cuando no ("¡Hola!"). Por
  // eso el template default escribe "¡Hola{nombre_responsable}!" sin
  // espacio antes de la llave.
  const respRaw = input.nombre_responsable ?? input.nombre_alumno ?? "";
  const respFormateado = respRaw ? ` ${respRaw}` : "";

  return {
    nombre_alumno: input.nombre_alumno ?? "",
    nombre_responsable: respFormateado,
    mes: mesNombre,
    detalle_clases: detalleClases,
    detalle_por_alumno: detallePorAlumno,
    cantidad_clases: (input.clases ?? []).length,
    monto: formatearMonto(input.monto),
    datos_pago: input.datos_pago ?? "",
  };
}

function formatFechaCorta(fechaIso: string): string {
  // Aceptamos "YYYY-MM-DD" y timestamps ISO; normalizamos a la hora 12
  // para evitar shifts de zona horaria.
  const seguro = fechaIso.length === 10 ? fechaIso + "T12:00:00" : fechaIso;
  const d = new Date(seguro);
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

// ============================================================
// Template default
// ============================================================

/**
 * Template default usado cuando maestras.template_recordatorio es NULL.
 * Refleja el tono de Trazos (cálido, rioplatense, profesional).
 */
export const TEMPLATE_DEFAULT = `¡Hola{nombre_responsable}! 👋 Te escribo por las clases de *{nombre_alumno}* de *{mes}*.

{detalle_clases}

Total a cobrar: *{monto}*

{datos_pago}

¡Cualquier duda me avisás! Gracias 😊`;

/**
 * Variante para familias con varios hermanos (cuando hay desglose
 * por alumno disponible).
 */
export const TEMPLATE_DEFAULT_FAMILIA = `¡Hola{nombre_responsable}! 👋 Te paso el resumen de *{mes}*:

{detalle_por_alumno}

Total a cobrar: *{monto}*

{datos_pago}

¡Cualquier duda me avisás! Gracias 😊`;
