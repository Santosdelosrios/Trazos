// ============================================================
// Configuración de la Landing — valores fáciles de ajustar
// ============================================================

/** Precio del plan Premium en ARS/mes. El Premium se vende DENTRO de la app;
 *  acá solo se muestra como referencia honesta. */
export const PRECIO_PREMIUM_ARS = 4500;

/** Límite de alumnos del plan gratis. Debe coincidir con PLAN_LIMITS.free
 *  en src/lib/plan.ts (hoy: 10). */
export const MAX_ALUMNOS_FREE = 10;

/** Cantidad de maestras en la beta privada (contador honesto, sin inventar). */
export const MAESTRAS_FUNDADORAS = 20;

/** Destino de todos los CTAs de la landing. */
export const REGISTRO_URL = "/registro";
export const LOGIN_URL = "/login";

/** Contacto y redes. */
export const CONTACTO_EMAIL = "trazosdemaestra@gmail.com";
export const INSTAGRAM_URL = "https://instagram.com/trazosdemaestra";

/** Formatea un monto en pesos argentinos (sin decimales). */
export function formatARS(monto: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(monto);
}
