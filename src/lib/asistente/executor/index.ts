// ============================================================
// Tool Executor — Router que despacha cada tool a su implementación
//
// NOTA: este módulo solo debe importarse desde route handlers.
// Ejecuta queries directas a Supabase con maestraId; no debe llegar
// al cliente.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolResult } from "../types";

import { buscarAlumno, cambiarModeloCobro } from "./alumnos";
import { agendarClases, cancelarClases, verAgendaDia } from "./agenda";
import {
  registrarPago,
  consultarSaldo,
  organizarCobroMes,
  cargarCreditosTool,
} from "./cobros";
import { resumenFinanciero, consultarFeriadosTool, obtenerBriefingHoy } from "./finanzas";

/**
 * Punto de entrada principal. Rutea la tool call a su implementación.
 * Si una tool no está registrada, devuelve un error sin throw —
 * el route handler decide qué hacer.
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
      case "obtener_briefing_hoy":
        return await obtenerBriefingHoy(supabase, maestraId);
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
