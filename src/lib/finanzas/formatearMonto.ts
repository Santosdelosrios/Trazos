/**
 * Formatea un monto numérico como moneda ARS.
 */
export function formatearMonto(monto: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monto);
}
