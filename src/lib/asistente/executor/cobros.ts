// ============================================================
// Tool executor: cobros (pagos, saldos, créditos, organizar mes)
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

export async function registrarPago(
  supabase: SupabaseClient,
  maestraId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const alumnoId = args.alumno_id as string;
  const fecha = args.fecha as string;
  const montoArg = args.monto as number | undefined;
  const estado = (args.estado as string) ?? "pagado";

  // 1. Buscar pago pendiente existente para este alumno (ignora soft-deleted)
  const { data: pagoExistente } = await supabase
    .from("pagos")
    .select("id, monto")
    .eq("alumno_id", alumnoId)
    .eq("maestra_id", maestraId)
    .eq("estado", "pendiente")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (pagoExistente) {
    const { error } = await supabase
      .from("pagos")
      .update({ estado, fecha_pago: fecha })
      .eq("id", pagoExistente.id)
      .is("deleted_at", null);

    if (error) {
      return { success: false, data: { error: error.message }, summary: "Error actualizando pago" };
    }

    return {
      success: true,
      data: { pago_id: pagoExistente.id, monto: pagoExistente.monto, estado, tipo: "actualizado" },
      summary: `Marqué como ${estado} un pago de $${pagoExistente.monto}`,
    };
  }

  // 2. No hay pago pendiente → crear nuevo
  let monto = montoArg;
  if (!monto) {
    const { data: tarifa } = await supabase
      .from("tarifas")
      .select("valor_hora")
      .eq("maestra_id", maestraId)
      .eq("activa", true)
      .order("vigente_desde", { ascending: false })
      .limit(1)
      .maybeSingle();

    monto = tarifa?.valor_hora ?? 0;
  }

  const { data: nuevoPago, error } = await supabase
    .from("pagos")
    .insert({
      maestra_id: maestraId,
      alumno_id: alumnoId,
      monto,
      estado,
      fecha_pago: fecha,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, data: { error: error.message }, summary: "Error creando pago" };
  }

  return {
    success: true,
    data: { pago_id: nuevoPago.id, monto, estado, tipo: "creado" },
    summary: `Registré un pago de $${monto} como ${estado}`,
  };
}

export async function consultarSaldo(
  supabase: SupabaseClient,
  maestraId: string,
  alumnoId: string
): Promise<ToolResult> {
  const { data: alumno, error: errAlumno } = await supabase
    .from("alumnos")
    .select("nombre, apellido, modelo_cobro, saldo_actual, tarifa_override")
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
  const saldo = alumno.saldo_actual ?? 0;
  const clases = count ?? 0;

  const modeloLabels: Record<string, string> = {
    por_clase: "Pago por Clase",
    bolsa_creditos: "Bolsa de Créditos",
    abono_mensual: "Abono Mensual",
    cuenta_corriente: "Cuenta Corriente",
  };

  let summaryText: string;
  switch (modelo) {
    case "bolsa_creditos":
      summaryText = saldo > 0
        ? `${alumno.nombre} tiene ${saldo} crédito(s) restante(s)`
        : `${alumno.nombre} se pasó ${Math.abs(saldo)} crédito(s)`;
      break;
    case "cuenta_corriente":
      summaryText = saldo > 0
        ? `${alumno.nombre} debe $${saldo}`
        : saldo < 0
        ? `${alumno.nombre} tiene $${Math.abs(saldo)} a favor`
        : `${alumno.nombre} está al día`;
      break;
    case "abono_mensual":
      summaryText = saldo > 0
        ? `${alumno.nombre} debe $${saldo} de abono`
        : `${alumno.nombre} está al día con el abono`;
      break;
    default:
      summaryText = `Saldo pendiente de ${alumno.nombre}: $${saldo}`;
  }

  return {
    success: true,
    data: {
      alumno: `${alumno.nombre} ${alumno.apellido}`,
      modelo_cobro: modelo,
      modelo_cobro_label: modeloLabels[modelo] || modelo,
      clases_dictadas: clases,
      saldo_actual: saldo,
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

  const { data: pago, error: errPago } = await supabase
    .from("pagos")
    .insert({
      maestra_id: maestraId,
      alumno_id: alumnoId,
      monto: monto,
      estado: "pagado",
      fecha_pago: new Date().toISOString().split("T")[0],
      nota: nota || `Pack de ${creditos} créditos (Asistente)`,
    })
    .select("id")
    .single();

  if (errPago) {
    return { success: false, data: { error: errPago.message }, summary: "Error registrando pago de créditos" };
  }

  const { error: errMov } = await supabase.from("movimientos_cuenta").insert({
    maestra_id: maestraId,
    alumno_id: alumnoId,
    tipo_movimiento: "pago_ingresado",
    monto: monto,
    creditos: creditos,
    referencia_id: pago?.id || null,
    descripcion: `Pack de ${creditos} clases (Asistente)`,
  });

  if (errMov) {
    return { success: false, data: { error: errMov.message }, summary: "Error registrando movimiento de créditos" };
  }

  return {
    success: true,
    data: { creditos_sumados: creditos, monto_cobrado: monto },
    summary: `Agregué ${creditos} créditos a la bolsa del alumno (por $${monto}).`,
  };
}
