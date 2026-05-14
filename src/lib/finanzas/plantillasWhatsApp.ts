import type { Alumno } from "@/lib/types/database";
import { formatearMonto } from "./formatearMonto";

/**
 * Genera un mensaje de recordatorio de pago para WhatsApp.
 */
export function recordatorioPago(params: {
  nombreMaestra: string;
  alumno: Pick<Alumno, "nombre" | "apellido">;
  monto: number;
  materia?: string;
  fecha?: string;
}): string {
  const { nombreMaestra, alumno, monto, materia, fecha } = params;
  const montoStr = formatearMonto(monto);

  let mensaje = `¡Hola! 👋 Te escribo de parte de *${nombreMaestra}*.`;

  if (materia && fecha) {
    mensaje += ` Quería recordarte que la clase de *${materia}* del *${fecha}*`;
  } else {
    mensaje += ` Quería recordarte que las clases de *${alumno.nombre}*`;
  }

  mensaje += ` tienen un saldo pendiente de *${montoStr}*.`;
  mensaje += `\n\n¡Cualquier duda me avisás! Gracias 😊`;

  return mensaje;
}

/**
 * Genera un reporte mensual resumido para WhatsApp.
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
 * Genera la URL de WhatsApp con el mensaje pre-cargado.
 * @param telefono - Número con código de país (ej: 5491112345678)
 * @param mensaje - Texto del mensaje
 */
export function generarLinkWhatsApp(telefono: string, mensaje: string): string {
  // Limpiar el teléfono (solo dígitos)
  const tel = telefono.replace(/\D/g, "");
  const textoEncoded = encodeURIComponent(mensaje);

  if (tel) {
    return `https://wa.me/${tel}?text=${textoEncoded}`;
  }
  // Sin número: abre WhatsApp sin destinatario
  return `https://wa.me/?text=${textoEncoded}`;
}
