// ============================================================
// Briefing del día — "El Buen Día de Tiza"
// Fuente de verdad compartida por el dashboard (card) y por la
// tool obtener_briefing_hoy del asistente. Se calcula on-demand.
//
// Nota: hoy se computa al abrir el dashboard. Si en el futuro se
// quiere precalcular de madrugada, este mismo cómputo puede moverse
// a un job pg_cron que persista el payload en una tabla `briefings`.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { getFeriados, formatFeriadoDate } from "@/lib/utils/feriados";

const TZ = "America/Argentina/Buenos_Aires";

// Modelos donde saldo_actual > 0 significa "debe plata".
// bolsa_creditos se excluye: ahí un saldo positivo son créditos a favor.
const MODELOS_DEUDA_MONETARIA = ["por_clase", "abono_mensual", "cuenta_corriente"];

export interface BriefingDia {
  saludo: string; // "Buen día" | "Buenas tardes" | "Buenas noches"
  momento: "manana" | "tarde" | "noche";
  nombre: string;
  fechaLarga: string; // "lunes 25 de mayo"
  clasesHoy: number;
  proximaClase: { hora: string; alumno: string } | null;
  deudores: { count: number; total: number; nombres: string[] };
  feriadoHoy: string | null;
}

function saludoPorHora(hora: number): { saludo: string; momento: BriefingDia["momento"] } {
  if (hora < 12) return { saludo: "Buen día", momento: "manana" };
  if (hora < 19) return { saludo: "Buenas tardes", momento: "tarde" };
  return { saludo: "Buenas noches", momento: "noche" };
}

/**
 * Arma el resumen del día de una maestra.
 * @param nombrePre nombre ya conocido (evita una query extra desde el dashboard).
 */
export async function obtenerBriefing(
  supabase: SupabaseClient,
  maestraId: string,
  nombrePre?: string
): Promise<BriefingDia> {
  const ahora = new Date();
  const fechaHoy = ahora.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD (AR)
  const horaAR = parseInt(
    ahora.toLocaleString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }),
    10
  );
  const minutoAR = parseInt(
    ahora.toLocaleString("en-GB", { timeZone: TZ, minute: "2-digit" }),
    10
  );
  const minutosAhora = horaAR * 60 + (isNaN(minutoAR) ? 0 : minutoAR);
  const anio = parseInt(fechaHoy.slice(0, 4), 10);

  const fechaLarga = ahora.toLocaleDateString("es-AR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const { saludo, momento } = saludoPorHora(isNaN(horaAR) ? 9 : horaAR);

  const [clasesRes, deudoresRes, nombreRes, feriadoMotivo] = await Promise.all([
    supabase
      .from("agenda")
      .select("hora, alumnos(nombre, apellido)")
      .eq("maestra_id", maestraId)
      .eq("fecha", fechaHoy)
      .eq("estado", "pendiente")
      .order("hora", { ascending: true }),

    supabase
      .from("alumnos")
      .select("nombre, apellido, saldo_actual, modelo_cobro")
      .eq("maestra_id", maestraId)
      .gt("saldo_actual", 0),

    nombrePre
      ? Promise.resolve({ data: { nombre: nombrePre } })
      : supabase.from("maestras").select("nombre").eq("id", maestraId).maybeSingle(),

    obtenerFeriadoHoy(fechaHoy, anio),
  ]);

  // --- Clases de hoy + próxima ---
  const clasesItems = (clasesRes.data || []) as {
    hora: string;
    alumnos: { nombre?: string; apellido?: string } | null;
  }[];
  const clasesHoy = clasesItems.length;

  let proximaClase: BriefingDia["proximaClase"] = null;
  for (const item of clasesItems) {
    const [h, m] = item.hora.split(":").map(Number);
    const itemMin = h * 60 + (m || 0);
    if (itemMin >= minutosAhora) {
      const a = item.alumnos;
      proximaClase = {
        hora: item.hora.substring(0, 5),
        alumno: a ? `${a.nombre || ""} ${a.apellido ? a.apellido.charAt(0) + "." : ""}`.trim() : "Alumno",
      };
      break;
    }
  }

  // --- Deudores (solo modelos de deuda monetaria) ---
  const deudoresRaw = (deudoresRes.data || []) as {
    nombre: string;
    apellido: string;
    saldo_actual: number;
    modelo_cobro: string;
  }[];
  const deudoresMonetarios = deudoresRaw.filter((a) =>
    MODELOS_DEUDA_MONETARIA.includes(a.modelo_cobro || "por_clase")
  );
  const deudores = {
    count: deudoresMonetarios.length,
    total: deudoresMonetarios.reduce((acc, a) => acc + (a.saldo_actual || 0), 0),
    nombres: deudoresMonetarios
      .sort((a, b) => (b.saldo_actual || 0) - (a.saldo_actual || 0))
      .slice(0, 3)
      .map((a) => `${a.nombre} ${a.apellido}`.trim()),
  };

  const nombre =
    (nombreRes as { data?: { nombre?: string } | null })?.data?.nombre || "Profe";

  return {
    saludo,
    momento,
    nombre,
    fechaLarga,
    clasesHoy,
    proximaClase,
    deudores,
    feriadoHoy: feriadoMotivo,
  };
}

async function obtenerFeriadoHoy(fechaHoy: string, anio: number): Promise<string | null> {
  try {
    const feriados = await getFeriados(anio);
    const hit = feriados.find((f) => formatFeriadoDate(f, anio) === fechaHoy);
    return hit ? hit.motivo : null;
  } catch {
    return null;
  }
}
