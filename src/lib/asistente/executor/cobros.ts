// ============================================================
// Tool executor: cobros (cargos, cobros, saldos, packs, organizar mes)
// Modelo nuevo (post-028): escribe en cargos / cobros / imputaciones.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolResult } from "../types";

const MONTH_NAMES = [
  "",
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * Registrar un cobro recibido del alumno. Si hay cargos pendientes
 * (sin imputación), imputamos al más viejo (FIFO). Si no hay cargos
 * pendientes, el cobro queda como saldo a favor.
 *
 * Conserva el nombre `registrarPago` por compatibilidad con el
 * registro de tools del asistente.
 */
export async function registrarPago(
  supabase: SupabaseClient,
  maestraId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const alumnoId = args.alumno_id as string;
  const fecha = (args.fecha as string) || new Date().toISOString().split("T")[0];
  let monto: number = (args.monto as number | undefined) ?? 0;

  // Monto por defecto: la tarifa activa (consistente con el comportamiento previo)
  if (!monto) {
    const { data: tarifa } = await supabase
      .from("tarifas")
      .select("valor_hora")
      .eq("maestra_id", maestraId)
      .eq("activa", true)
      .order("vigente_desde", { ascending: false })
      .limit(1)
      .maybeSingle();
    monto = (tarifa?.valor_hora as number | undefined) ?? 0;
  }

  // Insertar el cobro
  const { data: cobro, error: errCobro } = await supabase
    .from("cobros")
    .insert({
      maestra_id: maestraId,
      alumno_id: alumnoId,
      fecha,
      monto,
      origen: "manual",
      nota: "Registrado por el asistente",
    })
    .select("id")
    .single();
  if (errCobro) {
    return { success: false, data: { error: errCobro.message }, summary: "Error creando cobro" };
  }
  const cobroId = (cobro as { id: string }).id;

  // Buscar cargo pendiente más viejo (FIFO) para imputar
  const { data: pendientes } = await supabase.rpc(
    "clases_pendientes_imputacion",
    { p_alumno_id: alumnoId }
  );

  const cargoFifo = (pendientes ?? [])[0] as
    | { clase_id: string; monto_total: number; monto_imputado: number; pendiente: number }
    | undefined;

  if (cargoFifo && monto > 0) {
    const aImputar = Math.min(monto, Number(cargoFifo.pendiente));
    await supabase.from("imputaciones").insert({
      cobro_id: cobroId,
      // clases_pendientes_imputacion devuelve clase_id por compat de shape,
      // pero el id real del cargo es lo que necesitamos. Las versiones nuevas
      // del RPC devuelven cargo_id directamente; en la vista compat usamos
      // el mismo campo. Asumimos que la RPC retorna el cargo_id en clase_id.
      cargo_id: cargoFifo.clase_id,
      monto_imputado: aImputar,
    });
  }

  return {
    success: true,
    data: { cobro_id: cobroId, monto, imputado_a_cargo: cargoFifo?.clase_id ?? null },
    summary: cargoFifo
      ? `Registré un cobro de $${monto} e imputé al cargo más viejo`
      : `Registré un cobro de $${monto} (queda como saldo a favor)`,
  };
}

export async function consultarSaldo(
  supabase: SupabaseClient,
  maestraId: string,
  alumnoId: string
): Promise<ToolResult> {
  const { data: alumno, error: errAlumno } = await supabase
    .from("alumnos")
    .select("nombre, apellido, modelo_cobro, saldo_actual, creditos_actual, tarifa_override")
    .eq("id", alumnoId)
    .eq("maestra_id", maestraId)
    .single();

  if (errAlumno || !alumno) {
    return {
      success: false,
      data: { error: errAlumno?.message || "Alumno no encontrado" },
      summary: "Error consultando saldo",
    };
  }

  const { count } = await supabase
    .from("clase_alumnos")
    .select("id", { count: "exact", head: true })
    .eq("alumno_id", alumnoId);

  const modelo = alumno.modelo_cobro || "por_clase";
  const saldo = Number(alumno.saldo_actual) || 0;
  const creditos = Number(alumno.creditos_actual) || 0;
  const clases = count ?? 0;

  const modeloLabels: Record<string, string> = {
    por_clase: "Pago por Clase",
    bolsa_creditos: "Bolsa de Créditos",
    abono_mensual: "Abono Mensual",
  };

  let summaryText: string;
  switch (modelo) {
    case "bolsa_creditos":
      summaryText = creditos > 0
        ? `${alumno.nombre} tiene ${creditos} crédito(s) restante(s)`
        : creditos < 0
        ? `${alumno.nombre} se pasó ${Math.abs(creditos)} crédito(s) (debe $${saldo})`
        : `${alumno.nombre} agotó el pack`;
      break;
    case "abono_mensual":
      summaryText = saldo > 0
        ? `${alumno.nombre} debe $${saldo} de abono`
        : saldo < 0
        ? `${alumno.nombre} pagó $${Math.abs(saldo)} de más`
        : `${alumno.nombre} está al día con el abono`;
      break;
    default: // por_clase
      summaryText = saldo > 0
        ? `${alumno.nombre} debe $${saldo}`
        : saldo < 0
        ? `${alumno.nombre} tiene $${Math.abs(saldo)} a favor`
        : `${alumno.nombre} está al día`;
  }

  return {
    success: true,
    data: {
      alumno: `${alumno.nombre} ${alumno.apellido}`,
      modelo_cobro: modelo,
      modelo_cobro_label: modeloLabels[modelo] || modelo,
      clases_dictadas: clases,
      saldo_actual: saldo,
      creditos_actual: creditos,
      tarifa_override: alumno.tarifa_override,
    },
    summary: summaryText,
  };
}

export async function organizarCobroMes(
  supabase: SupabaseClient,
  maestraId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const alumnoId = args.alumno_id as string;
  const mes = args.mes as number;
  const anio = args.anio as number;

  const fechaInicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const fechaFin = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("nombre, apellido, grado, modelo_cobro, saldo_actual")
    .eq("id", alumnoId)
    .single();

  const { data: clasesDelMes } = await supabase
    .from("agenda")
    .select("id, fecha, hora, estado, tarifa_esperada, duracion_estimada")
    .eq("maestra_id", maestraId)
    .eq("alumno_id", alumnoId)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: true });

  // pagos_activos es una vista compat que apunta a cargos. estado=pendiente
  // significa que el cargo no tiene imputación total de un cobro.
  const { data: pagosPendientes } = await supabase
    .from("pagos_activos")
    .select("id, monto, estado, created_at, clase_id")
    .eq("maestra_id", maestraId)
    .eq("alumno_id", alumnoId)
    .eq("estado", "pendiente");

  const { data: tarifa } = await supabase
    .from("tarifas")
    .select("valor_hora")
    .eq("maestra_id", maestraId)
    .eq("activa", true)
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle();

  const saldoPendiente = alumno?.saldo_actual ?? 0;

  const clasesPendientes = (clasesDelMes || []).filter((c) => c.estado === "pendiente");
  const clasesCompletadas = (clasesDelMes || []).filter((c) => c.estado === "completada");
  const clasesCanceladas = (clasesDelMes || []).filter((c) => c.estado === "cancelada");
  const totalClasesMes = (clasesDelMes || []).length;

  const tarifaHora = tarifa?.valor_hora ?? 0;
  const clasesCobrables = clasesCompletadas.length + clasesPendientes.length;
  const totalEstimado = clasesCobrables * tarifaHora;

  const nombreMes = MONTH_NAMES[mes] || `mes ${mes}`;

  return {
    success: true,
    data: {
      alumno: alumno ? `${alumno.nombre} ${alumno.apellido}` : "Alumno no encontrado",
      grado: alumno?.grado ?? null,
      mes: nombreMes,
      anio,
      clases_del_mes: totalClasesMes,
      clases_completadas: clasesCompletadas.length,
      clases_pendientes_agenda: clasesPendientes.length,
      clases_canceladas: clasesCanceladas.length,
      clases_cobrables: clasesCobrables,
      detalle_clases: (clasesDelMes || []).map((c) => ({
        fecha: c.fecha,
        hora: c.hora,
        estado: c.estado,
        duracion: c.duracion_estimada,
      })),
      tarifa_hora: tarifaHora,
      total_estimado_mes: totalEstimado,
      pagos_pendientes_anteriores: (pagosPendientes || []).length,
      monto_pendiente_anterior: (pagosPendientes || []).reduce(
        (acc, p) => acc + (p.monto || 0),
        0
      ),
      saldo_pendiente_general: saldoPendiente,
    },
    summary: `${totalClasesMes} clases en ${nombreMes}, tarifa $${tarifaHora.toLocaleString("es-AR")}, total estimado $${totalEstimado.toLocaleString("es-AR")}`,
  };
}

/**
 * Cargar un pack de créditos para un alumno (modelo bolsa_creditos).
 * En el modelo nuevo, el pack es simplemente un cobro con
 * origen='pack' y creditos_otorgados=N. No usa movimientos_cuenta.
 */
export async function cargarCreditosTool(
  supabase: SupabaseClient,
  maestraId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const alumnoId = args.alumno_id as string;
  const creditos = args.creditos as number;
  let monto = args.monto as number | undefined;
  const nota = args.nota as string | undefined;

  if (monto === undefined) {
    const { data: alumno } = await supabase
      .from("alumnos")
      .select("tarifa_override")
      .eq("id", alumnoId)
      .eq("maestra_id", maestraId)
      .single();

    let tarifaCalculo = alumno?.tarifa_override;

    if (!tarifaCalculo) {
      const { data: tarifaGlobal } = await supabase
        .from("tarifas")
        .select("valor_hora")
        .eq("maestra_id", maestraId)
        .eq("activa", true)
        .order("vigente_desde", { ascending: false })
        .limit(1)
        .maybeSingle();

      tarifaCalculo = tarifaGlobal?.valor_hora ?? 0;
    }

    monto = creditos * tarifaCalculo;
  }

  const { error: errCobro } = await supabase
    .from("cobros")
    .insert({
      maestra_id: maestraId,
      alumno_id: alumnoId,
      fecha: new Date().toISOString().split("T")[0],
      monto,
      creditos_otorgados: creditos,
      origen: "pack",
      nota: nota || `Pack de ${creditos} créditos (Asistente)`,
    });

  if (errCobro) {
    return { success: false, data: { error: errCobro.message }, summary: "Error registrando pack" };
  }

  return {
    success: true,
    data: { creditos_sumados: creditos, monto_cobrado: monto },
    summary: `Agregué ${creditos} créditos a la bolsa del alumno (por $${monto}).`,
  };
}
