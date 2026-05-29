// ============================================================
// calcularMontoClase — helper único para derivar el monto de una
// clase a partir de la tarifa configurada por la maestra.
//
// Tipos de tarifa (migración 037):
//   - 'por_hora'  → monto = valor × duracion (comportamiento histórico)
//   - 'por_clase' → monto = valor (fijo, sin importar la duración)
//
// Lo centralizo acá para que todos los puntos del sistema que derivan
// monto desde tarifa (planificar, cerrar clase, mostrar agenda)
// usen la misma fórmula. Si después se cambia (ej: redondeo, mínimos),
// se hace en un solo lugar.
// ============================================================

export type TipoTarifa = "por_hora" | "por_clase";

export function calcularMontoClase(
  valor: number,
  tipo: TipoTarifa | null | undefined,
  duracionHoras: number,
): number {
  const v = Number(valor) || 0;
  const efectivo: TipoTarifa = tipo ?? "por_hora";
  if (efectivo === "por_clase") return Math.round(v);
  return Math.round(v * (Number(duracionHoras) || 0));
}

/** Label corto para mostrar al lado de un valor de tarifa. */
export function sufijoTarifa(tipo: TipoTarifa | null | undefined): string {
  return (tipo ?? "por_hora") === "por_clase" ? "/clase" : "/hora";
}

/** Label largo para etiquetar el input de valor. */
export function labelValorTarifa(tipo: TipoTarifa | null | undefined): string {
  return (tipo ?? "por_hora") === "por_clase" ? "Valor por clase" : "Valor por hora";
}
