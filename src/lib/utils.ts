import { clsx, type ClassValue } from "clsx";

/**
 * Combina clases CSS condicionalmente.
 * Wrapper liviano sobre clsx (sin tailwind-merge para mantener bundle chico).
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Formatea una fecha ISO a formato argentino legible.
 */
export function formatFechaAR(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Formatea fecha y hora.
 */
export function formatFechaHoraAR(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
