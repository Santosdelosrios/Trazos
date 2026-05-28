// ============================================================
// cierreClase.ts — Lógica unificada de cobro al cerrar una clase
//
// Modelo nuevo (post-migración 028): el cierre escribe en `cargos`.
// Una sola tabla, una sola fórmula de saldo (Σ cargos − Σ cobros).
//
// Reglas por modelo de cobro del alumno:
//
//   por_clase        → cargo concepto='clase', monto = tarifa × duración.
//   bolsa_creditos   → cargo concepto='clase', monto = tarifa × duración,
//                      creditos_consumidos = 1. El saldo monetario se
//                      compensa contra el cobro anticipado del pack.
//   abono_mensual    → no genera cargo de clase salvo excedente. En su
//                      lugar, lazy: la primera vez que se cierra una clase
//                      en un mes, inserta 1 cargo concepto='abono_mensual'
//                      por ese período. Idempotente vía UNIQUE
//                      (alumno_id, concepto, periodo).
//
// Flag de maestra cobros_automaticos_clases = false:
//   - por_clase / abono_mensual → no se genera nada (la maestra carga el
//     cobro a mano desde Cobranzas).
//   - bolsa_creditos → se genera un cargo con monto=0, creditos_consumidos=1
//     para que el contador de créditos siga avanzando (sin esto el pack
//     nunca termina).
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModeloCobro } from "@/lib/types/database";

export interface CierreClaseInput {
  /** ID de la clase ya creada (clases.id). */
  clase_id: string;
  /** Alumno cuya clase se cerró (la lógica usa su modelo de cobro). */
  alumno_id: string;
  /** Monto a cobrar (tarifa efectiva por la duración real). */
  monto: number;
  /** YYYY-MM-DD de la clase, usado para periodo del abono y para
   *  contar excedentes mensuales. */
  fecha_clase: string;
  /** Texto descriptivo para el cargo ("Clase: <tema>"). */
  descripcion?: string;
}

export interface CierreClaseResultado {
  /** Cargo generado (si correspondió). */
  cargo_id?: string;
  /** True si el cargo se generó por superar el tope del abono mensual. */
  excedente_abono: boolean;
  /** True si el cierre no generó nada porque el flag está apagado. */
  flag_apagado: boolean;
  /** Modelo de cobro aplicado. */
  modelo: ModeloCobro;
}

/**
 * Aplica la lógica de cargo de un cierre de clase. Mutaciones sobre
 * `cargos` (no toca `cobros` — eso es responsabilidad de quien marca
 * la clase como pagada).
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
  // 1. Datos del alumno (modelo + parámetros del abono) y flag de la maestra
  const [{ data: alumno }, { data: maestra }] = await Promise.all([
    supabase
      .from("alumnos")
      .select("modelo_cobro, monto_abono_mensual, tope_clases_mes")
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

  // 2. Flag apagado: para bolsa, descontamos crédito sin generar deuda
  //    monetaria. Para el resto, no hacemos nada.
  if (!flagActivo) {
    if (modelo === "bolsa_creditos") {
      await insertarCargoClase(supabase, maestraId, input, 0, 1);
    }
    return { excedente_abono: false, flag_apagado: true, modelo };
  }

  // 3. Aplicar lógica del modelo
  switch (modelo) {
    case "por_clase":
      return crearCargoClase(supabase, maestraId, input, input.monto, 0, modelo);

    case "bolsa_creditos": {
      const result = await crearCargoClase(supabase, maestraId, input, input.monto, 1, modelo);
      // Imputar el cargo contra los cobros 'pack' libres del alumno.
      // Sin esto, el cargo queda como "pendiente" y el cobro del pack
      // como "saldo a favor", incluso cuando conceptualmente la clase
      // está pagada por adelantado. Idempotente: skip si ya tiene
      // imputaciones (re-ejecución del cierre).
      if (result.cargo_id && input.monto > 0) {
        await imputarCargoContraPacks(
          supabase,
          maestraId,
          input.alumno_id,
          result.cargo_id,
          input.monto,
        );
      }
      return result;
    }

    case "abono_mensual":
      return aplicarAbonoMensual(
        supabase,
        maestraId,
        input,
        Number(alumno?.monto_abono_mensual) || 0,
        alumno?.tope_clases_mes ?? null
      );

    default:
      return { excedente_abono: false, flag_apagado: false, modelo };
  }
}

// ------------------------------------------------------------
// Helpers privados
// ------------------------------------------------------------

async function crearCargoClase(
  supabase: SupabaseClient,
  maestraId: string,
  input: CierreClaseInput,
  monto: number,
  creditosConsumidos: number,
  modelo: ModeloCobro
): Promise<CierreClaseResultado> {
  const cargoId = await insertarCargoClase(supabase, maestraId, input, monto, creditosConsumidos);
  return {
    cargo_id: cargoId,
    excedente_abono: false,
    flag_apagado: false,
    modelo,
  };
}

async function insertarCargoClase(
  supabase: SupabaseClient,
  maestraId: string,
  input: CierreClaseInput,
  monto: number,
  creditosConsumidos: number,
  descripcionOverride?: string
): Promise<string> {
  // Idempotencia por (clase_id, alumno_id): si ya existe un cargo
  // concepto='clase' no soft-deleted para esta clase y alumno, NO
  // creamos otro. Previene el doble cargo que aparece cuando dos
  // paths del cierre se ejecutan para la misma clase (cerrar express
  // desde la agenda + cerrar con evaluación, o doble click en el
  // botón "Marcar pendiente"). Equivalente al fix de 467fab4 sobre
  // el modelo viejo de `pagos`.
  const { data: existente } = await supabase
    .from("cargos")
    .select("id")
    .eq("clase_id", input.clase_id)
    .eq("alumno_id", input.alumno_id)
    .eq("maestra_id", maestraId)
    .eq("concepto", "clase")
    .is("deleted_at", null)
    .maybeSingle();

  if (existente) {
    return (existente as { id: string }).id;
  }

  const { data, error } = await supabase
    .from("cargos")
    .insert({
      maestra_id: maestraId,
      alumno_id: input.alumno_id,
      fecha: input.fecha_clase,
      concepto: "clase",
      monto,
      creditos_consumidos: creditosConsumidos,
      clase_id: input.clase_id,
      descripcion: descripcionOverride || input.descripcion || "Clase",
    })
    .select("id")
    .single();

  if (error) throw new Error("Error al generar cargo: " + error.message);
  return (data as { id: string }).id;
}

/**
 * Imputa un cargo de clase (modelo bolsa_creditos) contra los cobros
 * con origen='pack' del alumno que tengan saldo libre, FIFO por fecha.
 *
 * Sin esta imputación, el cargo queda como "pendiente" en la UI y el
 * pack como "saldo a favor", aunque la clase ya está pagada por
 * adelantado.
 *
 * Si no hay packs con saldo libre (pack agotado), no hace nada: el
 * cargo queda pendiente como deuda monetaria real — eso es correcto.
 *
 * Idempotente: si el cargo ya tiene imputaciones (re-ejecución del
 * cierre), descuenta de lo que falta cubrir y no duplica.
 */
async function imputarCargoContraPacks(
  supabase: SupabaseClient,
  maestraId: string,
  alumnoId: string,
  cargoId: string,
  montoCargo: number,
): Promise<void> {
  // Cuánto ya tiene imputado este cargo (idempotencia).
  const { data: yaImputado } = await supabase
    .from("imputaciones")
    .select("monto_imputado")
    .eq("cargo_id", cargoId);
  const totalYaImputado = (yaImputado ?? []).reduce(
    (acc, i) => acc + Number((i as { monto_imputado: number }).monto_imputado),
    0,
  );
  let restante = montoCargo - totalYaImputado;
  if (restante <= 0) return;

  // Cobros pack con saldo libre del alumno, ordenados FIFO.
  const { data: packs } = await supabase
    .from("cobros_libres_activos")
    .select("id, monto_libre")
    .eq("maestra_id", maestraId)
    .eq("alumno_id", alumnoId)
    .eq("origen", "pack")
    .order("fecha", { ascending: true });

  if (!packs || packs.length === 0) return;

  const filas: { cobro_id: string; cargo_id: string; monto_imputado: number }[] = [];
  for (const p of packs) {
    if (restante <= 0) break;
    const disponible = Number((p as { monto_libre: number }).monto_libre);
    const aImputar = Math.min(disponible, restante);
    if (aImputar > 0) {
      filas.push({
        cobro_id: (p as { id: string }).id,
        cargo_id: cargoId,
        monto_imputado: aImputar,
      });
      restante -= aImputar;
    }
  }

  if (filas.length > 0) {
    const { error } = await supabase.from("imputaciones").insert(filas);
    if (error) throw new Error("Error imputando cargo a pack: " + error.message);
  }
}

/**
 * Lógica del abono mensual.
 *
 * Genera lazy el cargo del mes (idempotente) y, si hay tope y se
 * superó, también un cargo de clase suelto por excedente.
 */
async function aplicarAbonoMensual(
  supabase: SupabaseClient,
  maestraId: string,
  input: CierreClaseInput,
  montoAbono: number,
  tope: number | null
): Promise<CierreClaseResultado> {
  const periodo = input.fecha_clase.slice(0, 7); // 'YYYY-MM'

  // 1. Generación lazy del cargo del abono. upsert con
  //    ignoreDuplicates aprovecha el UNIQUE(alumno_id, concepto, periodo)
  //    que define la migración 027: si ya existe el cargo del mes,
  //    este insert es noop.
  if (montoAbono > 0) {
    const { error } = await supabase
      .from("cargos")
      .upsert(
        {
          maestra_id: maestraId,
          alumno_id: input.alumno_id,
          fecha: `${periodo}-01`,
          concepto: "abono_mensual",
          monto: montoAbono,
          periodo,
          descripcion: `Abono mensual ${periodo}`,
        },
        { onConflict: "alumno_id,concepto,periodo", ignoreDuplicates: true }
      );
    if (error) throw new Error("Error al generar cargo de abono: " + error.message);
  }

  // 2. Sin tope: el abono mensual cubre todo, no hay excedentes.
  if (tope == null) {
    return { excedente_abono: false, flag_apagado: false, modelo: "abono_mensual" };
  }

  // 3. Contar clases del alumno en el mes. La actual ya fue creada
  //    por el caller (clase_alumnos), así que está incluida en el count.
  const { inicio, fin } = rangoMesISO(input.fecha_clase);
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

  // 4. Excedente: además del abono, esta clase genera un cargo suelto.
  const cargoId = await insertarCargoClase(
    supabase,
    maestraId,
    input,
    input.monto,
    0,
    "Clase excedente al tope del abono mensual"
  );
  return {
    cargo_id: cargoId,
    excedente_abono: true,
    flag_apagado: false,
    modelo: "abono_mensual",
  };
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
