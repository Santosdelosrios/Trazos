import type { Alumno } from "@/lib/types/database";
import { formatearMonto } from "./formatearMonto";
import {
  renderTemplate,
  buildVars,
  TEMPLATE_DEFAULT,
  TEMPLATE_DEFAULT_FAMILIA,
  type BuildVarsInput,
} from "./templateWhatsApp";

// ============================================================
// Recordatorio de pago — versión moderna (usa engine de templates)
// ============================================================

export interface RecordatorioParams {
  /** Template custom de la maestra. Si null/vacío usa el default. */
  template?: string | null;
  /** Para que el default elija template alumno vs familia. */
  esFamilia?: boolean;
  /** Datos para armar las variables. */
  vars: BuildVarsInput;
}

/**
 * Renderiza un recordatorio de pago. Si la maestra tiene un template
 * editado lo usa; si no, cae a uno de los defaults (alumno o familia).
 */
export function renderizarRecordatorio(params: RecordatorioParams): string {
  const template =
    (params.template && params.template.trim()) ||
    (params.esFamilia ? TEMPLATE_DEFAULT_FAMILIA : TEMPLATE_DEFAULT);
  const vars = buildVars(params.vars);
  return renderTemplate(template, vars);
}

// ============================================================
// Compat: API legacy (mantener para no romper consumidores antiguos)
// ============================================================

/**
 * Versión legacy — preservada para no romper TablaCobranzas y demás
 * call sites que arman el mensaje "a mano". Internamente delega al
 * engine nuevo con un dataset mínimo.
 */
export function recordatorioPago(params: {
  nombreMaestra: string;
  alumno: Pick<Alumno, "nombre" | "apellido">;
  monto: number;
  materia?: string;
  fecha?: string;
  /** Template editado por la maestra. Opcional. */
  template?: string | null;
  /** Datos de pago de la maestra. Opcional. */
  datos_pago?: string | null;
}): string {
  const { nombreMaestra, alumno, monto, materia, fecha, template, datos_pago } = params;

  // Si la maestra tiene un template custom, usamos el engine.
  if (template && template.trim()) {
    return renderizarRecordatorio({
      template,
      vars: {
        nombre_alumno: `${alumno.nombre} ${alumno.apellido}`.trim(),
        monto,
        datos_pago,
        clases: materia && fecha ? [{ fecha, tema: materia, monto }] : [],
      },
    });
  }

  // Fallback mínimo "estilo viejo" — preservado tal cual estaba para
  // no cambiar el copy de las maestras que no editaron nada.
  const montoStr = formatearMonto(monto);
  let mensaje = `¡Hola! 👋 Te escribo de parte de *${nombreMaestra}*.`;
  if (materia && fecha) {
    mensaje += ` Quería recordarte que la clase de *${materia}* del *${fecha}*`;
  } else {
    mensaje += ` Quería recordarte que las clases de *${alumno.nombre}*`;
  }
  mensaje += ` tienen un saldo pendiente de *${montoStr}*.`;
  if (datos_pago) {
    mensaje += `\n\n${datos_pago}`;
  }
  mensaje += `\n\n¡Cualquier duda me avisás! Gracias 😊`;

  return mensaje;
}

/**
 * Reporte mensual resumido (sin cambios funcionales — sigue manual
 * por ahora). Se va a unificar con el engine en una próxima iteración
 * si las maestras lo piden editable.
 */
export function reporteMensual(params: {
  nombreMaestra: string;
  alumno: Pick<Alumno, "nombre" | "apellido">;
  mes: string;
  clasesTotales: number;
  montoTotal: number;
  saldoPendiente: number;
}): string {
  const { nombreMaestra, alumno, mes, clasesTotales, montoTotal, saldoPendiente } = params;

  let mensaje = `📊 *Resumen de ${mes}* — ${alumno.nombre} ${alumno.apellido}\n`;
  mensaje += `De parte de: *${nombreMaestra}*\n\n`;
  mensaje += `📚 Clases dictadas: *${clasesTotales}*\n`;
  mensaje += `💰 Monto total: *${formatearMonto(montoTotal)}*\n`;

  if (saldoPendiente > 0) {
    mensaje += `⚠️ Saldo pendiente: *${formatearMonto(saldoPendiente)}*\n`;
  } else {
    mensaje += `✅ ¡Todo al día! Sin saldo pendiente.\n`;
  }

  mensaje += `\n¡Gracias por confiar en nosotros! 🌟`;

  return mensaje;
}

/**
 * URL de WhatsApp con mensaje pre-cargado.
 * @param telefono Número con código de país (solo dígitos). Si vacío
 *   abre WhatsApp sin destinatario.
 */
export function generarLinkWhatsApp(telefono: string, mensaje: string): string {
  const tel = telefono.replace(/\D/g, "");
  const textoEncoded = encodeURIComponent(mensaje);
  if (tel) return `https://wa.me/${tel}?text=${textoEncoded}`;
  return `https://wa.me/?text=${textoEncoded}`;
}
