// ============================================================
// desglose.ts — Estructura común para desglosar saldo por alumno
//
// Usada por:
//  - Vista /finanzas/cuentas (expansión "por familia")
//  - Comprobante de pago (PR-5)
//  - Template WhatsApp con variable {detalle_por_alumno} (PR-4)
//
// Fuente única para que las tres salidas se mantengan consistentes.
// ============================================================

import type { DetalleFamiliaItem, ModeloCobro } from "@/lib/types/database";
import { formatearMonto } from "./formatearMonto";

export interface LineaDesglose {
  alumno_id: string;
  nombre_completo: string;
  modelo_cobro: ModeloCobro;
  saldo_actual: number;
  /** true cuando el saldo representa deuda monetaria (excluye bolsa_creditos). */
  es_deuda_monetaria: boolean;
}

const MODELOS_DEUDA_MONETARIA: ModeloCobro[] = [
  "por_clase",
  "abono_mensual",
  "cuenta_corriente",
];

export function armarDesgloseFamilia(items: DetalleFamiliaItem[]): {
  lineas: LineaDesglose[];
  totalDeuda: number;
} {
  const lineas = items.map<LineaDesglose>((i) => ({
    alumno_id: i.alumno_id,
    nombre_completo: `${i.nombre} ${i.apellido}`.trim(),
    modelo_cobro: i.modelo_cobro,
    saldo_actual: i.saldo_actual,
    es_deuda_monetaria: MODELOS_DEUDA_MONETARIA.includes(i.modelo_cobro),
  }));
  const totalDeuda = lineas
    .filter((l) => l.es_deuda_monetaria)
    .reduce((acc, l) => acc + l.saldo_actual, 0);
  return { lineas, totalDeuda };
}

/**
 * Renderiza el desglose para el template de WhatsApp.
 * Una línea por alumno con saldo.
 */
export function desgloseATextoWhatsApp(lineas: LineaDesglose[]): string {
  return lineas
    .filter((l) => l.es_deuda_monetaria && l.saldo_actual !== 0)
    .map((l) => `• ${l.nombre_completo}: ${formatearMonto(l.saldo_actual)}`)
    .join("\n");
}
