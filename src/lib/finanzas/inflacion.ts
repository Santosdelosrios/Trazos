// ============================================================
// inflacion.ts — Cálculo de tarifa sugerida por inflación
//
// La DB devuelve `inflacion_acumulada` (fracción decimal) desde la
// fecha de la última tarifa hasta el mes anterior al actual. Acá
// aplicamos ese factor a la tarifa actual y redondeamos a algo
// "lindo" (múltiplos de 100 o 500 según magnitud).
// ============================================================

export interface SugerenciaTarifa {
  /** Tarifa actual sin ajustar. */
  actual: number;
  /** Tarifa sugerida redondeada. */
  sugerida: number;
  /** Inflación acumulada como porcentaje (4.2 = 4.2%). */
  inflacionPct: number;
  /** Meses transcurridos desde vigente_desde de la tarifa. */
  meses: number;
}

/**
 * Redondea hacia arriba a un múltiplo "lindo":
 *  - Si el valor es < 1000 → múltiplo de 50.
 *  - Si está entre 1000 y 10000 → múltiplo de 100.
 *  - Si es >= 10000 → múltiplo de 500.
 *
 * Redondear *hacia arriba* es deliberado: nunca queremos sugerir un
 * aumento que quede *por debajo* de la inflación real.
 */
export function redondearTarifa(valor: number): number {
  if (valor <= 0) return 0;
  let step = 100;
  if (valor < 1000) step = 50;
  else if (valor >= 10000) step = 500;
  return Math.ceil(valor / step) * step;
}

export function calcularSugerencia(input: {
  tarifaActual: number;
  inflacionAcumulada: number; // fracción decimal (0.42 = 42%)
  meses: number;
}): SugerenciaTarifa {
  const factor = 1 + Math.max(0, input.inflacionAcumulada);
  const sugerida = redondearTarifa(input.tarifaActual * factor);
  return {
    actual: input.tarifaActual,
    sugerida,
    inflacionPct: Math.round(input.inflacionAcumulada * 1000) / 10, // 1 decimal
    meses: Math.max(0, input.meses),
  };
}

/**
 * Diferencia en meses entre dos fechas. Cuenta solo meses calendario
 * completos (ej: 2024-01-15 → 2024-03-10 = 1 mes, no 2).
 */
export function mesesEntreFechas(desde: string, hasta: Date = new Date()): number {
  const d = new Date(desde.length === 10 ? desde + "T12:00:00" : desde);
  const diffYears = hasta.getFullYear() - d.getFullYear();
  const diffMonths = hasta.getMonth() - d.getMonth();
  const total = diffYears * 12 + diffMonths;
  // Si el día del mes ya pasó en `hasta`, sumamos el mes en curso
  const ajuste = hasta.getDate() >= d.getDate() ? 0 : -1;
  return Math.max(0, total + ajuste);
}
