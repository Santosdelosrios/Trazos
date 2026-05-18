// ============================================================
// Tool Executor — Ejecuta function calls contra Supabase
// Cada función recibe el client autenticado + maestraId (RLS)
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolResult } from "./types";

/**
 * Punto de entrada principal. Rutea la tool call a su implementación.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  maestraId: string
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "buscar_alumno":
        return await buscarAlumno(supabase, maestraId, args.query as string);
      case "agendar_clases":
        return await agendarClases(supabase, maestraId, args);
      case "cancelar_clases":
        return await cancelarClases(supabase, maestraId, args);
      case "registrar_pago":
        return await registrarPago(supabase, maestraId, args);
      case "consultar_saldo":
        return await consultarSaldo(supabase, maestraId, args.alumno_id as string);
      case "ver_agenda_dia":
        return await verAgendaDia(supabase, maestraId, args.fecha as string);
      case "resumen_financiero":
        return await resumenFinanciero(supabase, maestraId);
      case "organizar_cobro_mes":
        return await organizarCobroMes(supabase, maestraId, args);
      case "consultar_feriados":
        return await consultarFeriadosTool(args.anio as number);
      case "cambiar_modelo_cobro":
        return await cambiarModeloCobro(supabase, maestraId, args);
      case "cargar_creditos":
        return await cargarCreditosTool(supabase, maestraId, args);
      default:
        return {
          success: false,
          data: { error: `Tool desconocida: ${toolName}` },
          summary: `Tool "${toolName}" no reconocida`,
        };
    }
  } catch (error) {
    console.error(`❌ Error ejecutando tool ${toolName}:`, error);
    return {
      success: false,
      data: { error: error instanceof Error ? error.message : "Error desconocido" },
      summary: `Error al ejecutar ${toolName}`,
    };
  }
}

// ============================================================
// Implementaciones individuales
// ============================================================

async function buscarAlumno(
  supabase: SupabaseClient,
  maestraId: string,
  query: string
): Promise<ToolResult> {
  let queryBuilder = supabase
    .from("alumnos")
    .select("id, nombre, apellido, grado, modelo_cobro, saldo_actual")
    .eq("maestra_id", maestraId);

  const tokens = query.trim().split(/\s+/);
  for (const token of tokens) {
    queryBuilder = queryBuilder.or(`nombre.ilike.%${token}%,apellido.ilike.%${token}%`);
  }

  const { data, error } = await queryBuilder.limit(5);

  if (error) {
    return { success: false, data: { error: error.message }, summary: "Error buscando alumno" };
  }

  if (!data || data.length === 0) {
    return {
      success: true,
      data: { alumnos: [], count: 0 },
      summary: `No se encontraron alumnos con "${query}"`,
    };
  }

  return {
    success: true,
    data: {
      alumnos: data.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        apellido: a.apellido,
        grado: a.grado,
        modelo_cobro: a.modelo_cobro || "por_clase",
        saldo_actual: a.saldo_actual || 0,
      })),
      count: data.length,
    },
    summary: `Encontré ${data.length} alumno(s) con "${query}"`,
  };
}

async function agendarClases(
  supabase: SupabaseClient,
  maestraId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const alumnoId = args.alumno_id as string;
  const fechas = (args.fechas as string[]) || [];
  const hora = args.hora as string;
  const duracion = (args.duracion_estimada as number) ?? 1;
  const confirmacionFeriado = args.confirmacion_feriado as boolean | undefined;

  if (fechas.length === 0) {
    return { success: false, data: { error: "Faltan fechas" }, summary: "No se proporcionaron fechas para agendar." };
  }

  // Validación de Feriados (Soft Warning)
  if (!confirmacionFeriado) {
    const { getFeriados, formatFeriadoDate } = await import("@/lib/utils/feriados");
    const primeraFecha = new Date(fechas[0] + "T12:00:00");
    const anio = isNaN(primeraFecha.getTime()) ? new Date().getFullYear() : primeraFecha.getFullYear();
    const feriados = await getFeriados(anio);
    
    const feriadosMatch = fechas.map(fecha => {
      const isFeriado = feriados.find(f => formatFeriadoDate(f, anio) === fecha);
      return isFeriado ? { fecha, motivo: isFeriado.motivo } : null;
    }).filter(Boolean);

    if (feriadosMatch.length > 0) {
      const match = feriadosMatch[0]!;
      return {
        success: false,
        data: { error_feriado: true, fecha: match.fecha, motivo: match.motivo },
        summary: `Pausa: la fecha ${match.fecha} es feriado por ${match.motivo}. Preguntale a la maestra si quiere agendar igual. Si dice que sí, volvé a llamar a agendar_clases con confirmacion_feriado en true.`,
      };
    }
  }

  // Obtener tarifa activa para tarifa_esperada
  const { data: tarifa } = await supabase
    .from("tarifas")
    .select("valor_hora")
    .eq("maestra_id", maestraId)
    .eq("activa", true)
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rows = fechas.map((fecha) => ({
    maestra_id: maestraId,
    alumno_id: alumnoId,
    fecha,
    hora,
    materia: "otro", // Default ya que no se filtra por materia
    duracion_estimada: duracion,
    estado: "pendiente",
    tarifa_esperada: tarifa?.valor_hora ?? null,
  }));

  const { data, error } = await supabase.from("agenda").insert(rows).select("id, fecha, hora");

  if (error) {
    return { success: false, data: { error: error.message }, summary: "Error agendando clases" };
  }

  const fechasResult = (data || []).map((r) => r.fecha);
  return {
    success: true,
    data: { clases_agendadas: data?.length ?? 0, fechas: fechasResult },
    summary: `Agendé ${data?.length ?? 0} clase(s) a las ${hora} para las fechas solicitadas.`,
  };
}

async function cancelarClases(
  supabase: SupabaseClient,
  maestraId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const alumnoId = args.alumno_id as string;
  const fechas = args.fechas as string[];

  const { data, error } = await supabase
    .from("agenda")
    .delete()
    .eq("maestra_id", maestraId)
    .eq("alumno_id", alumnoId)
    .in("fecha", fechas)
    .select("id, fecha");

  if (error) {
    return { success: false, data: { error: error.message }, summary: "Error cancelando clases" };
  }

  return {
    success: true,
    data: { clases_canceladas: data?.length ?? 0, fechas: data?.map(d => d.fecha) || [] },
    summary: `Cancelé ${data?.length ?? 0} clase(s) en las fechas indicadas.`,
  };
}

async function registrarPago(
  supabase: SupabaseClient,
  maestraId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const alumnoId = args.alumno_id as string;
  const fecha = args.fecha as string;
  const montoArg = args.monto as number | undefined;
  const estado = (args.estado as string) ?? "pagado";

  // 1. Buscar pago pendiente existente para este alumno
  const { data: pagoExistente } = await supabase
    .from("pagos")
    .select("id, monto")
    .eq("alumno_id", alumnoId)
    .eq("maestra_id", maestraId)
    .eq("estado", "pendiente")
    .limit(1)
    .maybeSingle();

  if (pagoExistente) {
    // Actualizar pago existente
    const { error } = await supabase
      .from("pagos")
      .update({ estado, fecha_pago: fecha })
      .eq("id", pagoExistente.id);

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

async function consultarSaldo(
  supabase: SupabaseClient,
  maestraId: string,
  alumnoId: string
): Promise<ToolResult> {
  // Leer saldo cacheado + modelo de cobro directamente (sin RPC pesada)
  const { data: alumno, error: errAlumno } = await supabase
    .from("alumnos")
    .select("nombre, apellido, modelo_cobro, saldo_actual, tarifa_override")
    .eq("id", alumnoId)
    .eq("maestra_id", maestraId)
    .single();

  if (errAlumno || !alumno) {
    return { success: false, data: { error: errAlumno?.message || "Alumno no encontrado" }, summary: "Error consultando saldo" };
  }

  // Clases dictadas (siempre útil)
  const { count } = await supabase
    .from("clase_alumnos")
    .select("id", { count: "exact", head: true })
    .eq("alumno_id", alumnoId);

  const modelo = alumno.modelo_cobro || "por_clase";
  const saldo = alumno.saldo_actual ?? 0;
  const clases = count ?? 0;

  // Generar resumen según modelo
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

async function verAgendaDia(
  supabase: SupabaseClient,
  maestraId: string,
  fecha: string
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from("agenda")
    .select("id, hora, estado, duracion_estimada, alumnos(nombre, apellido)")
    .eq("maestra_id", maestraId)
    .eq("fecha", fecha)
    .order("hora", { ascending: true });

  if (error) {
    return { success: false, data: { error: error.message }, summary: "Error consultando agenda" };
  }

  const clases = (data || []).map((item) => {
    const alumnoObj = item.alumnos as { nombre?: string; apellido?: string } | null;
    return {
      hora: item.hora,
      alumno: alumnoObj
        ? `${alumnoObj.nombre || ""} ${alumnoObj.apellido || ""}`.trim()
        : "Sin alumno",
      estado: item.estado,
      duracion: item.duracion_estimada,
    };
  });

  return {
    success: true,
    data: { fecha, clases, total: clases.length },
    summary: clases.length > 0
      ? `Tenés ${clases.length} clase(s) agendada(s) para el ${fecha}`
      : `No tenés clases agendadas para el ${fecha}`,
  };
}

async function resumenFinanciero(
  supabase: SupabaseClient,
  maestraId: string
): Promise<ToolResult> {
  const { data, error } = await supabase.rpc("resumen_financiero_mes", {
    p_maestra_id: maestraId,
  });

  if (error) {
    return { success: false, data: { error: error.message }, summary: "Error en resumen financiero" };
  }

  const resumen = Array.isArray(data) ? data[0] : data;

  return {
    success: true,
    data: {
      ingresos_mes: resumen?.ingresos_mes ?? 0,
      gastos_mes: resumen?.gastos_mes ?? 0,
      ganancia_neta: resumen?.ganancia_neta ?? 0,
      pagos_pendientes: resumen?.pagos_pendientes ?? 0,
    },
    summary: `Ganancia neta del mes: $${resumen?.ganancia_neta ?? 0}`,
  };
}

// ============================================================
// Organizar Cobro Mensual — Recopila datos sin tomar acción
// ============================================================

const MONTH_NAMES = [
  "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

async function organizarCobroMes(
  supabase: SupabaseClient,
  maestraId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const alumnoId = args.alumno_id as string;
  const mes = args.mes as number;
  const anio = args.anio as number;

  // Construir rango de fechas del mes solicitado
  const fechaInicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const fechaFin = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;

  // 1. Obtener datos del alumno (incluyendo saldo cacheado)
  const { data: alumno } = await supabase
    .from("alumnos")
    .select("nombre, apellido, grado, modelo_cobro, saldo_actual")
    .eq("id", alumnoId)
    .single();

  // 2. Clases agendadas en el mes (todas, sin importar estado)
  const { data: clasesDelMes } = await supabase
    .from("agenda")
    .select("id, fecha, hora, estado, tarifa_esperada, duracion_estimada")
    .eq("maestra_id", maestraId)
    .eq("alumno_id", alumnoId)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: true });

  // 3. Pagos pendientes (de cualquier período)
  const { data: pagosPendientes } = await supabase
    .from("pagos")
    .select("id, monto, estado, created_at, clase_id")
    .eq("maestra_id", maestraId)
    .eq("alumno_id", alumnoId)
    .eq("estado", "pendiente");

  // 4. Tarifa activa
  const { data: tarifa } = await supabase
    .from("tarifas")
    .select("valor_hora")
    .eq("maestra_id", maestraId)
    .eq("activa", true)
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 5. Saldo: leer directo del campo cacheado
  const saldoPendiente = alumno?.saldo_actual ?? 0;

  // Clasificar clases del mes
  const clasesPendientes = (clasesDelMes || []).filter((c) => c.estado === "pendiente");
  const clasesCompletadas = (clasesDelMes || []).filter((c) => c.estado === "completada");
  const clasesCanceladas = (clasesDelMes || []).filter((c) => c.estado === "cancelada");
  const totalClasesMes = (clasesDelMes || []).length;

  // Calcular total estimado
  const tarifaHora = tarifa?.valor_hora ?? 0;
  // Contar las clases que se van a cobrar (completadas + pendientes, no canceladas)
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

async function consultarFeriadosTool(anio: number): Promise<ToolResult> {
  const { getFeriados, formatFeriadoDate } = await import("@/lib/utils/feriados");
  const feriados = await getFeriados(anio);
  const feriadosList = feriados.map(f => `${formatFeriadoDate(f, anio)}: ${f.motivo} (${f.tipo})`);

  return {
    success: true,
    data: { anio, feriados: feriadosList, total: feriadosList.length },
    summary: `Consulté ${feriadosList.length} feriados de Argentina para el año ${anio}.`,
  };
}

async function cambiarModeloCobro(
  supabase: SupabaseClient,
  maestraId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const alumnoId = args.alumno_id as string;
  const nuevoModelo = args.nuevo_modelo as string;
  const tarifaOverride = args.tarifa_override as number | undefined;

  const validModels = ["por_clase", "bolsa_creditos", "abono_mensual", "cuenta_corriente"];
  if (!validModels.includes(nuevoModelo)) {
    return { success: false, data: { error: "Modelo inválido" }, summary: "Modelo de cobro no reconocido" };
  }

  const { error } = await supabase
    .from("alumnos")
    .update({ 
      modelo_cobro: nuevoModelo,
      tarifa_override: tarifaOverride ?? null 
    })
    .eq("id", alumnoId)
    .eq("maestra_id", maestraId);

  if (error) {
    return { success: false, data: { error: error.message }, summary: "Error actualizando modelo de cobro" };
  }

  return {
    success: true,
    data: { alumno_id: alumnoId, nuevo_modelo: nuevoModelo, tarifa_override: tarifaOverride },
    summary: `Cambié el modelo de cobro a '${nuevoModelo}'${tarifaOverride ? ` con una tarifa personalizada de $${tarifaOverride}` : ''}.`,
  };
}

async function cargarCreditosTool(
  supabase: SupabaseClient,
  maestraId: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const alumnoId = args.alumno_id as string;
  const creditos = args.creditos as number;
  let monto = args.monto as number | undefined;
  const nota = args.nota as string | undefined;

  // Si no se proporcionó monto, calculamos usando la tarifa
  if (monto === undefined) {
    // 1. Obtener tarifa del alumno o tarifa general
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

  // 2. Registrar el pago monetario
  const { data: pago, error: errPago } = await supabase.from("pagos").insert({
    maestra_id: maestraId,
    alumno_id: alumnoId,
    monto: monto,
    estado: "pagado",
    fecha_pago: new Date().toISOString().split("T")[0],
    nota: nota || `Pack de ${creditos} créditos (Asistente)`,
  }).select("id").single();

  if (errPago) {
    return { success: false, data: { error: errPago.message }, summary: "Error registrando pago de créditos" };
  }

  // 3. Registrar movimiento con créditos positivos
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

  // 4. Llamar explícitamente a recalcular_saldo para obtener el saldo actualizado si es necesario (el trigger lo hace, pero podemos devolver confirmación)
  return {
    success: true,
    data: { creditos_sumados: creditos, monto_cobrado: monto },
    summary: `Agregué ${creditos} créditos a la bolsa del alumno (por $${monto}).`,
  };
}

