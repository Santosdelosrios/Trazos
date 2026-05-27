// ============================================================
// briefingFinanzas.ts — Contexto compacto para que Tiza arme un
// briefing en lenguaje natural sobre el estado financiero del mes.
//
// Lo separamos del client de Gemini para que sea testeable y para
// que el contexto sea reutilizable si en el futuro queremos exponerlo
// como JSON al frontend.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ContextoBriefingFinanzas {
  nombreMaestra: string;
  mes: string;        // "mayo"
  anio: number;
  ingresosMes: number;
  gastosMes: number;
  netoMes: number;
  proyectado: number;
  deudores: {
    count: number;
    total: number;
    top: Array<{ nombre: string; monto: number }>;
  };
  mejorAlumno: { nombre: string; total: number } | null;
  ingresosMesAnterior: number;
  variacionPct: number | null;  // null si no hay base comparable
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const MODELOS_DEUDA = ["por_clase", "abono_mensual", "cuenta_corriente"];

/**
 * Arma el contexto leyendo de la DB. Hace 4 queries en paralelo —
 * todas son livianas porque usan RPCs y vistas indexadas.
 */
export async function obtenerContextoBriefing(
  supabase: SupabaseClient,
  maestraId: string
): Promise<ContextoBriefingFinanzas> {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;

  const [
    { data: maestra },
    { data: resumen },
    { data: proyeccion },
    { data: deudoresRaw },
    { data: reporteRaw },
  ] = await Promise.all([
    supabase.from("maestras").select("nombre").eq("id", maestraId).maybeSingle(),
    supabase.rpc("resumen_financiero_mes", { p_maestra_id: maestraId }),
    supabase.rpc("proyeccion_mes", { p_maestra_id: maestraId }),
    supabase
      .from("alumnos")
      .select("nombre, apellido, saldo_actual, modelo_cobro")
      .eq("maestra_id", maestraId)
      .in("modelo_cobro", MODELOS_DEUDA)
      .gt("saldo_actual", 0),
    supabase.rpc("reporte_mes", { p_maestra_id: maestraId, p_anio: anio, p_mes: mes }),
  ]);

  const r = resumen?.[0] as { ingresos_mes?: number; gastos_mes?: number; ganancia_neta?: number } | undefined;
  const proy = proyeccion?.[0] as { proyectado?: number } | undefined;
  const reporte = reporteRaw as {
    top_alumnos?: Array<{ nombre: string; total: number }>;
    comparativo?: { ingresos_anterior?: number; var_ingresos_pct?: number | null };
  } | null;

  const deudores = ((deudoresRaw ?? []) as Array<{ nombre: string; apellido: string; saldo_actual: number }>)
    .sort((a, b) => Number(b.saldo_actual) - Number(a.saldo_actual));

  const top = deudores.slice(0, 3).map((a) => ({
    nombre: `${a.nombre} ${a.apellido}`.trim(),
    monto: Number(a.saldo_actual),
  }));
  const totalDeudores = deudores.reduce((acc, a) => acc + Number(a.saldo_actual), 0);

  const mejorAlumno = reporte?.top_alumnos?.[0]
    ? { nombre: reporte.top_alumnos[0].nombre, total: Number(reporte.top_alumnos[0].total) }
    : null;

  return {
    nombreMaestra: maestra?.nombre ?? "Profe",
    mes: MESES[hoy.getMonth()],
    anio,
    ingresosMes: Number(r?.ingresos_mes ?? 0),
    gastosMes: Number(r?.gastos_mes ?? 0),
    netoMes: Number(r?.ganancia_neta ?? 0),
    proyectado: Number(proy?.proyectado ?? 0),
    deudores: {
      count: deudores.length,
      total: totalDeudores,
      top,
    },
    mejorAlumno,
    ingresosMesAnterior: Number(reporte?.comparativo?.ingresos_anterior ?? 0),
    variacionPct: reporte?.comparativo?.var_ingresos_pct ?? null,
  };
}

/**
 * Prompt para Gemini. Tono Trazos: cálido, rioplatense, conciso.
 * Pedimos JSON estructurado para que la card pueda renderizar partes
 * por separado (saludo, resumen, acción sugerida).
 */
export function buildPromptBriefing(ctx: ContextoBriefingFinanzas): string {
  return `Sos Tiza, la asistente pedagógica de Trazos para maestras particulares argentinas. Tu tono es cálido, cercano, voseo rioplatense, sin tecnicismos. Sos breve y accionable.

Tarea: armar un BRIEFING FINANCIERO del mes en curso para ${ctx.nombreMaestra}, en 3 frases cortas, hablándole de vos.

DATOS DEL MES DE ${ctx.mes.toUpperCase()} ${ctx.anio}:
- Ingresos cobrados: $${ctx.ingresosMes.toLocaleString("es-AR")}
- Gastos: $${ctx.gastosMes.toLocaleString("es-AR")}
- Ganancia neta: $${ctx.netoMes.toLocaleString("es-AR")}
- Proyectado del mes (si todo lo agendado se concreta): $${ctx.proyectado.toLocaleString("es-AR")}
- Te deben: $${ctx.deudores.total.toLocaleString("es-AR")} (${ctx.deudores.count} alumno/s)
${ctx.deudores.top.length > 0 ? `- Top deudores: ${ctx.deudores.top.map((d) => `${d.nombre} ($${d.monto.toLocaleString("es-AR")})`).join(", ")}` : ""}
${ctx.mejorAlumno ? `- Tu mejor alumno este mes: ${ctx.mejorAlumno.nombre} ($${ctx.mejorAlumno.total.toLocaleString("es-AR")})` : ""}
${ctx.variacionPct != null ? `- Variación vs mes anterior: ${ctx.variacionPct > 0 ? "+" : ""}${ctx.variacionPct}%` : ""}

REGLAS:
1. NO repitas los números crudos. Hacé observaciones cualitativas usando los datos.
2. Mencioná al alumno destacado o al deudor principal por su nombre cuando aporte color.
3. Si la variación vs mes anterior es positiva, celebrá; si es negativa, no asustes pero notalo.
4. La 3ra frase tiene que sugerir UNA acción concreta (ej: "¿Querés que mande recordatorios?").
5. Máximo 3 frases. Sin emojis salvo uno al final si aporta calidez.

Respondé ÚNICAMENTE con un JSON válido, sin markdown:
{
  "saludo": "1 frase de saludo + observación general del mes",
  "destacado": "1 frase destacando algo positivo o un alumno",
  "accion_sugerida": "1 frase con CTA accionable"
}`;
}

export interface BriefingFinanzasRespuesta {
  saludo: string;
  destacado: string;
  accion_sugerida: string;
}

/**
 * Fallback determinístico si Gemini falla o no está configurado.
 * Frases armadas con templating directo del contexto.
 */
export function briefingFallback(ctx: ContextoBriefingFinanzas): BriefingFinanzasRespuesta {
  const variacion = ctx.variacionPct;
  const tendencia = variacion == null
    ? ""
    : variacion > 0
      ? `, +${variacion}% vs el mes pasado`
      : variacion < 0
        ? `, ${variacion}% vs el mes pasado`
        : "";

  const saludo = `Hola ${ctx.nombreMaestra}. En ${ctx.mes} llevás $${ctx.ingresosMes.toLocaleString("es-AR")} facturados${tendencia}.`;

  let destacado = "Sin novedades de alumnos destacados este mes.";
  if (ctx.mejorAlumno) {
    destacado = `${ctx.mejorAlumno.nombre} fue tu mejor cliente con $${ctx.mejorAlumno.total.toLocaleString("es-AR")}.`;
  }

  let accion = "Seguí así.";
  if (ctx.deudores.count > 0) {
    accion = `Te deben $${ctx.deudores.total.toLocaleString("es-AR")} (${ctx.deudores.count} alumno${ctx.deudores.count === 1 ? "" : "s"}). ¿Querés que armemos los recordatorios?`;
  } else if (ctx.proyectado > ctx.ingresosMes * 1.2) {
    accion = `Si todo lo agendado se concreta, vas a cerrar el mes en $${ctx.proyectado.toLocaleString("es-AR")}.`;
  }

  return { saludo, destacado, accion_sugerida: accion };
}
