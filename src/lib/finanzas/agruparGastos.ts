// ============================================================
// agruparGastos.ts — Top-N + "Otros" para el desglose de gastos
//
// Función pura, separable del componente, para que el cálculo del
// gráfico sea testeable y reutilizable (futuro: usar en el cierre de
// mes / PDF de reporte).
// ============================================================

import type { GastoPorCategoriaMes } from "@/lib/types/database";

export interface FilaAgrupada {
  nombre: string;
  total: number;
  cant: number;
  /** True si esta fila es la agregación "Otros (N)". */
  agrupada: boolean;
}

/**
 * Devuelve `topN` filas detalladas + una fila "Otros" con el resto
 * agregado, si hay más de `topN` categorías. Asume que `items` ya
 * viene ordenado por total desc (es lo que devuelve la RPC).
 */
export function agruparGastosTopN(
  items: GastoPorCategoriaMes[],
  topN: number
): FilaAgrupada[] {
  const filas: FilaAgrupada[] = items.slice(0, topN).map((i) => ({
    nombre: i.nombre,
    total: Number(i.total),
    cant: Number(i.cant),
    agrupada: false,
  }));

  if (items.length <= topN) return filas;

  const resto = items.slice(topN);
  filas.push({
    nombre: `Otros (${resto.length})`,
    total: resto.reduce((acc, i) => acc + Number(i.total), 0),
    cant: resto.reduce((acc, i) => acc + Number(i.cant), 0),
    agrupada: true,
  });
  return filas;
}
