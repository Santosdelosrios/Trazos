// ============================================================
// cierreClase.ts — Lógica unificada de cobro al cerrar una clase
//
// Antes de PR-2 esto vivía duplicado en:
//  - src/app/(dashboard)/agenda/actions.ts          → cerrarClaseExpress
//  - src/app/(dashboard)/clases/nueva/actions.ts    → registrarCobroClase
//
// Ahora ambos llaman a aplicarModeloCobroCierre(). Reglas:
//
// 1. Si la maestra tiene cobros_automaticos_clases = false, el cierre
//    NO genera cobros ni movimientos (los modelos siguen funcionando
//    porque la maestra puede cargar el cobro a mano desde Cobranzas).
//    Excepción: bolsa_creditos descuenta el crédito igual, porque sin
//    eso la bolsa nunca termina.
//
// 2. Si está en true:
//    - por_clase:        pago pendiente, origen 'auto_clase'.
//    - bolsa_creditos:   descuenta 1 crédito (movimiento clase_descontada).
//    - cuenta_corriente: cargo en movimientos (monto negativo).
//    - abono_mensual:    sin cargo, salvo que se supere el tope mensual.
//      Si abonos.tope_clases_mes es N y este alumno ya tiene N clases
//      cerradas en el mes (excluyendo la que se está cerrando ahora,
//      que aún no está vinculada), la clase actual genera un cobro
//      suelto con origen 'abono_excedente'.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModeloCobro } from "@/lib/types/database";

export interface CierreClaseInput {
  /** ID de la clase ya creada (clases.id) */
  clase_id: string;
  /** Alumno cuya clase se cerró (la lógica usa su modelo de cobro). */
  alumno_id: string;
  /** Monto a cobrar (tarifa efectiva por la duración real). */
  monto: number;
  /** YYYY-MM-DD de la clase, usado para detectar excedentes mensuales. */
  fecha_clase: string;
  /** Texto descriptivo para el movimiento ("Clase: <tema>"). */
  descripcion?: string;
}

export interface CierreClaseResultado {
  /** Cobro generado (si correspondió). */
  pago_id?: string;
  /** True si el cobro se generó por superar el tope del abono mensual. */
  excedente_abono: boolean;
  /** True si el cierre no generó nada porque el flag está apagado. */
  flag_apagado: boolean;
  /** Modelo de cobro aplicado. */
  modelo: ModeloCobro;
}

/**
 * Aplica la lógica de cobro de un cierre de clase. Mutaciones en una
 * sola transacción lógica (Supabase no soporta tx multi-statement vía
 * SDK, así que cada paso es independiente y los errores se propagan).
 *
 * El caller es responsable de:
 *  - Haber creado la fila en `clases` y el vínculo `clase_alumnos`.
 *  - Marcar la agenda como completada (si aplica).
 *  - Revalidar paths/tags.
 */
export async function aplicarModeloCobroCierre(
  supabase: SupabaseClient,
  maestraId: string,
  input: CierreClaseInput
): Promise<CierreClaseResultado> {
  // 1. Datos del alumno + flag de la maestra
  const [{ data: alumno }, { data: maestra }] = await Promise.all([
    supabase
      .from("alumnos")
      .select("modelo_cobro")
      .eq("id", input.alumno_id)
      .eq("maestra_id", maestraId)
      .maybeSingle(),
    supabase
      .from("maestras")
      .select("cobros_automaticos_clases")
      .eq("id", maestraId)
      .maybeSingle(),
  ]);

  const modelo: ModeloCobro = (alumno?.modelo_cobro as ModeloCobro) || "por_clase";
  const flagActivo = maestra?.cobros_automaticos_clases !== false;

  // 2. Si el flag está apagado, solo descontamos crédito (bolsa). El
  //    resto se queda quieto: la maestra cargará el cobro a mano.
  if (!flagActivo) {
    if (modelo === "bolsa_creditos") {
      await insertarMovimiento(supabase, maestraId, input, -1, 0, "clase_descontada");
    }
    return { excedente_abono: false, flag_apagado: true, modelo };
  }

  // 3. Aplicar lógica del modelo
  switch (modelo) {
    case "por_clase":
      return await crearPagoPendiente(supabase, maestraId, input, "auto_clase");

    case "bolsa_creditos":
      await insertarMovimiento(supabase, maestraId, input, -1, 0, "clase_descontada");
      return { excedente_abono: false, flag_apagado: false, modelo };

    case "cuenta_corriente":
      await insertarMovimiento(supabase, maestraId, input, 0, -input.monto, "clase_descontada");
      return { excedente_abono: false, flag_apagado: false, modelo };

    case "abono_mensual":
      return await aplicarAbonoMensual(supabase, maestraId, input);

    default:
      return { excedente_abono: false, flag_apagado: false, modelo };
  }
}

// ------------------------------------------------------------
// Helpers privados
// ------------------------------------------------------------

async function crearPagoPendiente(
  supabase: SupabaseClient,
  maestraId: string,
  input: CierreClaseInput,
  origen: "auto_clase" | "abono_excedente"
): Promise<CierreClaseResultado> {
  // Idempotencia por (clase_id, alumno_id): si ya hay un pago no
  // soft-deleted para esta clase y alumno, NO creamos otro. Esto
  // previene el doble cobro que aparecía cuando dos paths del cierre
  // generaban pago para la misma clase (ej: la maestra cierra desde
  // la agenda y después marca pendiente desde el wizard de evaluación,
  // o un doble click en el botón).
  //
  // Para excedente_abono mantenemos el guard porque conceptualmente
  // una clase = un cobro: si el helper ya creó el cobro pendiente
  // del abono mensual, no debería duplicarlo aunque se vuelva a llamar.
  const { data: existente } = await supabase
    .from("pagos")
    .select("id")
    .eq("clase_id", input.clase_id)
    .eq("alumno_id", input.alumno_id)
    .eq("maestra_id", maestraId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existente) {
    return {
      pago_id: existente.id,
      excedente_abono: origen === "abono_excedente",
      flag_apagado: false,
      modelo: origen === "abono_excedente" ? "abono_mensual" : "por_clase",
    };
  }

  const { data, error } = await supabase
    .from("pagos")
    .insert({
      maestra_id: maestraId,
      alumno_id: input.alumno_id,
      clase_id: input.clase_id,
      monto: input.monto,
      estado: "pendiente",
      fecha_pago: null,
      origen,
      nota: origen === "abono_excedente"
        ? "Clase excedente al tope del abono mensual"
        : null,
    })
    .select("id")
    .single();

  if (error) throw new Error("Error al generar cobro automático: " + error.message);

  return {
    pago_id: data!.id,
    excedente_abono: origen === "abono_excedente",
    flag_apagado: false,
    modelo: origen === "abono_excedente" ? "abono_mensual" : "por_clase",
  };
}

async function insertarMovimiento(
  supabase: SupabaseClient,
  maestraId: string,
  input: CierreClaseInput,
  creditos: number,
  monto: number,
  tipo: "clase_descontada"
) {
  const { error } = await supabase.from("movimientos_cuenta").insert({
    maestra_id: maestraId,
    alumno_id: input.alumno_id,
    tipo_movimiento: tipo,
    monto,
    creditos,
    referencia_id: input.clase_id,
    descripcion: input.descripcion || "Clase cerrada",
  });
  if (error) throw new Error("Error al registrar movimiento: " + error.message);
}

/**
 * Cuenta cuántas clases del alumno cayeron dentro del mismo mes
 * calendario que la actual. Si pasa del tope del abono activo, la
 * clase actual se cobra suelta (excedente).
 *
 * Devuelve sin crear cobro cuando:
 *  - No hay abono activo con tope (NULL) → sin tope, no genera nada.
 *  - Aún quedan créditos dentro del tope.
 */
async function aplicarAbonoMensual(
  supabase: SupabaseClient,
  maestraId: string,
  input: CierreClaseInput
): Promise<CierreClaseResultado> {
  // Abono activo del alumno
  const { data: abono } = await supabase
    .from("abonos")
    .select("tope_clases_mes")
    .eq("alumno_id", input.alumno_id)
    .eq("maestra_id", maestraId)
    .eq("activo", true)
    .maybeSingle();

  const tope = abono?.tope_clases_mes as number | null | undefined;
  if (tope == null) {
    // Sin tope: comportamiento histórico, no se genera nada.
    return { excedente_abono: false, flag_apagado: false, modelo: "abono_mensual" };
  }

  // Rango del mes en que cayó la clase
  const { inicio, fin } = rangoMesISO(input.fecha_clase);

  // Cuento clases del alumno en ese mes (incluye la actual, ya creada
  // por el caller). Si la cuenta es > tope, esta clase es excedente.
  const { count } = await supabase
    .from("clase_alumnos")
    .select("clases!inner(fecha,maestra_id)", { count: "exact", head: true })
    .eq("alumno_id", input.alumno_id)
    .eq("clases.maestra_id", maestraId)
    .gte("clases.fecha", inicio)
    .lte("clases.fecha", fin);

  const clasesEnMes = count ?? 0;
  if (clasesEnMes <= tope) {
    return { excedente_abono: false, flag_apagado: false, modelo: "abono_mensual" };
  }

  // Excedente: cobro suelto
  return await crearPagoPendiente(supabase, maestraId, input, "abono_excedente");
}

export function rangoMesISO(fecha: string): { inicio: string; fin: string } {
  // fecha viene "YYYY-MM-DD". Trabajo a string para evitar problemas de TZ.
  const [y, m] = fecha.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return {
    inicio: `${y}-${mm}-01`,
    fin:    `${y}-${mm}-${String(ultimoDia).padStart(2, "0")}`,
  };
}
