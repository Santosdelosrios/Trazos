// ============================================================
// reporteMes.ts — Shape + fetch del reporte de cierre de mes
//
// El RPC reporte_mes devuelve un jsonb con todo agregado. Acá lo
// tipamos, normalizamos (numeric → number) y exponemos una función
// que el route handler usa.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResumenMes {
  ingresos: number;
  gastos: number;
  neto: number;
  cant_pagos: number;
  cant_gastos: number;
}

export interface AlumnoFila {
  nombre: string;
  total: number;
  cant_clases: number;
}

export interface FamiliaFila {
  nombre: string;
  total: number;
}

export interface CategoriaFila {
  nombre: string;
  total: number;
  cant: number;
}

export interface ComparativoMes {
  ingresos_anterior: number;
  gastos_anterior: number;
  neto_anterior: number;
  var_ingresos_pct: number | null;
  var_neto_pct: number | null;
}

export interface DatosReporteMes {
  periodo: { anio: number; mes: number; desde: string; hasta: string };
  resumen: ResumenMes;
  comparativo: ComparativoMes;
  top_alumnos: AlumnoFila[];
  top_familias: FamiliaFila[];
  gastos_por_categoria: CategoriaFila[];
  /** Nombre de la maestra (no viene del RPC, lo cargamos aparte). */
  maestra: { nombre: string };
}

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function nombreMes(mes: number): string {
  return MESES_LARGOS[Math.max(0, Math.min(11, mes - 1))];
}

/**
 * Normaliza la respuesta del RPC convirtiendo strings numéricos a
 * number. Postgres NUMERIC se serializa como string por PostgREST.
 *
 * Función pura para que sea fácil de testear sin Supabase.
 */
export function normalizarReporte(raw: unknown, nombreMaestra: string): DatosReporteMes {
  const r = raw as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const num = (v: unknown) => Number(v ?? 0);
  const numOrNull = (v: unknown) => (v == null ? null : Number(v));

  return {
    periodo: {
      anio:  num(r.periodo?.anio),
      mes:   num(r.periodo?.mes),
      desde: String(r.periodo?.desde ?? ""),
      hasta: String(r.periodo?.hasta ?? ""),
    },
    resumen: {
      ingresos:    num(r.resumen?.ingresos),
      gastos:      num(r.resumen?.gastos),
      neto:        num(r.resumen?.neto),
      cant_pagos:  num(r.resumen?.cant_pagos),
      cant_gastos: num(r.resumen?.cant_gastos),
    },
    comparativo: {
      ingresos_anterior: num(r.comparativo?.ingresos_anterior),
      gastos_anterior:   num(r.comparativo?.gastos_anterior),
      neto_anterior:     num(r.comparativo?.neto_anterior),
      var_ingresos_pct:  numOrNull(r.comparativo?.var_ingresos_pct),
      var_neto_pct:      numOrNull(r.comparativo?.var_neto_pct),
    },
    top_alumnos: ((r.top_alumnos ?? []) as Array<Record<string, unknown>>).map((a) => ({
      nombre:      String(a.nombre ?? ""),
      total:       num(a.total),
      cant_clases: num(a.cant_clases),
    })),
    top_familias: ((r.top_familias ?? []) as Array<Record<string, unknown>>).map((f) => ({
      nombre: String(f.nombre ?? ""),
      total:  num(f.total),
    })),
    gastos_por_categoria: ((r.gastos_por_categoria ?? []) as Array<Record<string, unknown>>).map((g) => ({
      nombre: String(g.nombre ?? ""),
      total:  num(g.total),
      cant:   num(g.cant),
    })),
    maestra: { nombre: nombreMaestra },
  };
}

/**
 * Fetch del reporte. Devuelve null si la maestra no existe o no hay
 * sesión válida.
 */
export async function getDatosReporteMes(
  supabase: SupabaseClient,
  maestraId: string,
  anio: number,
  mes: number
): Promise<DatosReporteMes | null> {
  const [{ data: rpc }, { data: maestra }] = await Promise.all([
    supabase.rpc("reporte_mes", { p_maestra_id: maestraId, p_anio: anio, p_mes: mes }),
    supabase.from("maestras").select("nombre").eq("id", maestraId).maybeSingle(),
  ]);
  if (!rpc) return null;
  return normalizarReporte(rpc, maestra?.nombre ?? "Profe");
}
