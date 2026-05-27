// ============================================================
// imputacion.ts — Motor de imputación de pagos a clases
//
// Cuando la maestra recibe un monto menor al saldo total del alumno,
// elige (o deja por default) a qué clases imputar el pago. FIFO por
// default: las clases más viejas se cubren primero.
//
// Reglas del motor:
//  - Cada clase puede recibir 0…N de su `pendiente`.
//  - Suma de imputaciones ≤ monto del pago. El sobrante queda como
//    "saldo a favor" (visible en el dashboard del alumno, pero no se
//    materializa en una imputación dummy).
//  - Las imputaciones manuales (override) respetan el orden que diga
//    la UI y los montos que diga la UI, siempre que la validación
//    pase (positivo, ≤ pendiente).
// ============================================================

export interface ClasePendienteImputacion {
  clase_id: string;
  fecha: string;        // YYYY-MM-DD o ISO timestamp
  tema: string;
  monto_total: number;
  monto_imputado: number;
  pendiente: number;
}

export interface LineaImputacion {
  clase_id: string;
  monto_imputado: number;
}

export interface ResultadoImputacion {
  lineas: LineaImputacion[];
  /** Sobrante (sin imputar a ninguna clase). Queda como crédito a favor. */
  saldo_a_favor: number;
}

/**
 * Reparte un monto entre clases pendientes en orden FIFO (primero las
 * más viejas). Ignora clases sin pendiente. Si el monto excede el
 * total pendiente, devuelve `saldo_a_favor > 0`.
 *
 * Asume que `clases` ya viene ordenado por fecha asc (es lo que devuelve
 * la RPC `clases_pendientes_imputacion`); si no, ordenamos por las dudas.
 */
export function armarImputacionFIFO(
  clases: ClasePendienteImputacion[],
  montoTotal: number
): ResultadoImputacion {
  if (montoTotal <= 0) return { lineas: [], saldo_a_favor: 0 };

  const ordenadas = clases
    .filter((c) => c.pendiente > 0)
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const lineas: LineaImputacion[] = [];
  let restante = montoTotal;

  for (const c of ordenadas) {
    if (restante <= 0) break;
    const aImputar = Math.min(c.pendiente, restante);
    lineas.push({ clase_id: c.clase_id, monto_imputado: aImputar });
    restante -= aImputar;
  }

  return {
    lineas,
    saldo_a_favor: Math.max(0, restante),
  };
}

/**
 * Valida un set manual de imputaciones contra el catálogo de clases
 * pendientes y un monto total disponible. Lanza con mensaje específico
 * si algo no cuadra.
 */
export function validarImputacionManual(
  clases: ClasePendienteImputacion[],
  lineas: LineaImputacion[],
  montoTotal: number
): { saldo_a_favor: number } {
  if (montoTotal <= 0) {
    throw new Error("El monto del pago debe ser mayor a 0.");
  }

  const indice = new Map(clases.map((c) => [c.clase_id, c]));
  let suma = 0;

  for (const l of lineas) {
    if (l.monto_imputado <= 0) {
      throw new Error("Las imputaciones tienen que ser mayores a 0.");
    }
    const c = indice.get(l.clase_id);
    if (!c) {
      throw new Error("Una de las clases imputadas no está en la lista de pendientes.");
    }
    if (l.monto_imputado > c.pendiente + 0.001) {
      throw new Error(
        `Imputaste $${l.monto_imputado} a una clase del ${c.fecha.slice(0, 10)} pero solo quedaban $${c.pendiente} pendientes.`
      );
    }
    suma += l.monto_imputado;
  }

  if (suma > montoTotal + 0.001) {
    throw new Error(
      `Las imputaciones suman $${suma.toFixed(2)} pero el pago es de $${montoTotal.toFixed(2)}.`
    );
  }

  return { saldo_a_favor: Math.max(0, montoTotal - suma) };
}
