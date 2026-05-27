// ============================================================
// datosComprobante.ts — Fuente única de datos del comprobante de pago
//
// Esta función arma el shape que consume la route /api/comprobante.
// Separamos el armado puro de los datos (testeable) del fetching
// contra Supabase. La función fetch sí necesita el client.
//
// Casos cubiertos:
//   1. Pago vinculado a una sola clase (clase_id) → detalle = esa clase.
//   2. Pago con imputaciones_pago → detalle = lista FIFO de clases imputadas.
//   3. Pago sin clase_id ni imputaciones → detalle vacío (solo se ve el total).
//   4. Alumno pertenece a familia → mostramos también nombre de familia.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MedioPago, EstadoPago } from "@/lib/types/database";

export interface LineaComprobante {
  fecha: string;        // YYYY-MM-DD
  tema: string;
  monto: number;
}

export interface DatosComprobante {
  pago: {
    id: string;
    monto: number;
    estado: EstadoPago;
    medio_pago: MedioPago | null;
    fecha_pago: string | null;       // YYYY-MM-DD
    nota: string | null;
    created_at: string;
  };
  maestra: {
    nombre: string;
    datos_pago: string | null;
  };
  alumno: {
    nombre: string;
    apellido: string;
    familia_nombre: string | null;   // si pertenece a familia
  };
  lineas: LineaComprobante[];
  total: number;
}

// ------------------------------------------------------------
// Builder puro (testeable)
// ------------------------------------------------------------

export interface InputBuilder {
  pago: {
    id: string;
    monto: number;
    estado: EstadoPago;
    medio_pago: MedioPago | null;
    fecha_pago: string | null;
    nota: string | null;
    clase_id: string | null;
    created_at: string;
  };
  maestra: { nombre: string; datos_pago: string | null };
  alumno: { nombre: string; apellido: string; familia_nombre: string | null };
  /** Clase asociada al pago (cuando clase_id != null). */
  claseAsociada: { fecha: string; tema: string } | null;
  /** Imputaciones del pago con datos de la clase, ordenadas por fecha asc. */
  imputaciones: Array<{ clase_id: string; monto_imputado: number; fecha: string; tema: string }>;
}

/**
 * Arma el DatosComprobante a partir de los datos crudos.
 *
 * Prioridad para "lineas":
 *  1. Si hay imputaciones → una línea por imputación (cobro parcial).
 *  2. Sino, si hay clase asociada → una sola línea con esa clase.
 *  3. Sino → array vacío (la UI muestra "Pago general" o similar).
 */
export function armarDatosComprobante(input: InputBuilder): DatosComprobante {
  let lineas: LineaComprobante[];

  if (input.imputaciones.length > 0) {
    lineas = input.imputaciones.map((i) => ({
      fecha: normalizarFecha(i.fecha),
      tema: i.tema || "Clase",
      monto: i.monto_imputado,
    }));
  } else if (input.claseAsociada) {
    lineas = [{
      fecha: normalizarFecha(input.claseAsociada.fecha),
      tema: input.claseAsociada.tema || "Clase",
      monto: input.pago.monto,
    }];
  } else {
    lineas = [];
  }

  const total = lineas.length > 0
    ? lineas.reduce((acc, l) => acc + l.monto, 0)
    : input.pago.monto;

  return {
    pago: {
      id: input.pago.id,
      monto: input.pago.monto,
      estado: input.pago.estado,
      medio_pago: input.pago.medio_pago,
      fecha_pago: input.pago.fecha_pago,
      nota: input.pago.nota,
      created_at: input.pago.created_at,
    },
    maestra: input.maestra,
    alumno: input.alumno,
    lineas,
    total,
  };
}

function normalizarFecha(raw: string): string {
  // Acepta timestamp ISO o YYYY-MM-DD; siempre devuelve YYYY-MM-DD.
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}

// ------------------------------------------------------------
// Fetch + builder (server-side)
// ------------------------------------------------------------

/**
 * Carga todos los datos necesarios del comprobante para un pago.
 * Devuelve null si el pago no existe o no es de la maestra logueada.
 */
export async function getDatosComprobante(
  supabase: SupabaseClient,
  pagoId: string,
  maestraId: string
): Promise<DatosComprobante | null> {
  // 1. Pago + alumno + familia + maestra en un solo round-trip
  const { data: pagoRow } = await supabase
    .from("pagos_activos")
    .select(`
      id, monto, estado, medio_pago, fecha_pago, nota, clase_id, created_at,
      alumnos!inner (
        nombre, apellido,
        familia:familias!alumnos_familia_id_fkey ( nombre )
      )
    `)
    .eq("id", pagoId)
    .eq("maestra_id", maestraId)
    .maybeSingle();

  if (!pagoRow) return null;

  const alumnoRaw = pagoRow.alumnos as unknown as
    | {
        nombre: string;
        apellido: string;
        familia: { nombre: string } | { nombre: string }[] | null;
      };
  const fam = Array.isArray(alumnoRaw.familia) ? alumnoRaw.familia[0] : alumnoRaw.familia;

  // 2. Maestra (nombre + datos_pago)
  const { data: maestraRow } = await supabase
    .from("maestras")
    .select("nombre, datos_pago")
    .eq("id", maestraId)
    .maybeSingle();

  // 3. Clase asociada (si clase_id existe)
  let claseAsociada: { fecha: string; tema: string } | null = null;
  if (pagoRow.clase_id) {
    const { data: c } = await supabase
      .from("clases")
      .select("fecha, tema")
      .eq("id", pagoRow.clase_id)
      .maybeSingle();
    if (c) claseAsociada = { fecha: c.fecha, tema: c.tema };
  }

  // 4. Imputaciones con datos de la clase
  const { data: impRows } = await supabase
    .from("imputaciones_pago")
    .select("clase_id, monto_imputado, clases!inner(fecha, tema)")
    .eq("pago_id", pagoId);

  const imputaciones = (impRows ?? []).map((r) => {
    const c = r.clases as unknown as { fecha: string; tema: string } | { fecha: string; tema: string }[];
    const clase = Array.isArray(c) ? c[0] : c;
    return {
      clase_id: r.clase_id as string,
      monto_imputado: Number(r.monto_imputado),
      fecha: clase?.fecha ?? "",
      tema: clase?.tema ?? "",
    };
  }).sort((a, b) => a.fecha.localeCompare(b.fecha)); // FIFO

  return armarDatosComprobante({
    pago: {
      id: pagoRow.id,
      monto: Number(pagoRow.monto),
      estado: pagoRow.estado,
      medio_pago: pagoRow.medio_pago,
      fecha_pago: pagoRow.fecha_pago,
      nota: pagoRow.nota,
      clase_id: pagoRow.clase_id,
      created_at: pagoRow.created_at,
    },
    maestra: {
      nombre: maestraRow?.nombre ?? "Profe",
      datos_pago: maestraRow?.datos_pago ?? null,
    },
    alumno: {
      nombre: alumnoRaw.nombre,
      apellido: alumnoRaw.apellido,
      familia_nombre: fam?.nombre ?? null,
    },
    claseAsociada,
    imputaciones,
  });
}
