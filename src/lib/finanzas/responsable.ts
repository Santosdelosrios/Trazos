// ============================================================
// responsable.ts — Resolución del contacto del responsable de pago
//
// La cadena de fallback es:
//   1. familia.responsable_telefono / responsable_nombre
//   2. alumno.responsable_telefono  / responsable_nombre
//   3. null (sin contacto)
//
// Normaliza el teléfono al formato E.164 sin signo + (ej. 5491123456789)
// que es el que espera wa.me.
//
// Reglas de normalización para Argentina:
//   - Si arranca con "+", se respeta el código de país que pongan.
//   - Si arranca con "54", se toma como ya argentino.
//   - Si arranca con "0" o sin código, se asume AR y se antepone "549".
//     (El 9 después del 54 indica móvil; obligatorio para WhatsApp).
//   - Se conservan solo dígitos.
// ============================================================

export interface AlumnoConContacto {
  responsable_nombre?: string | null;
  responsable_telefono?: string | null;
  familia?: {
    responsable_nombre?: string | null;
    responsable_telefono?: string | null;
  } | null;
}

export interface ContactoResponsable {
  nombre: string | null;
  telefono: string | null; // ya normalizado para wa.me, o null
  origen: "familia" | "alumno" | null;
}

export function obtenerResponsableContacto(
  alumno: AlumnoConContacto
): ContactoResponsable {
  const fam = alumno.familia;
  if (fam?.responsable_telefono || fam?.responsable_nombre) {
    return {
      nombre: fam.responsable_nombre ?? null,
      telefono: normalizarTelefonoAR(fam.responsable_telefono ?? null),
      origen: "familia",
    };
  }
  if (alumno.responsable_telefono || alumno.responsable_nombre) {
    return {
      nombre: alumno.responsable_nombre ?? null,
      telefono: normalizarTelefonoAR(alumno.responsable_telefono ?? null),
      origen: "alumno",
    };
  }
  return { nombre: null, telefono: null, origen: null };
}

/**
 * Normaliza un teléfono al formato E.164 sin signo "+", compatible con
 * https://wa.me/<digitos>. Devuelve null si la entrada no tiene dígitos
 * suficientes para ser razonable.
 */
export function normalizarTelefonoAR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const tienePlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;

  // Si vino con "+", confiamos en el código de país que pusieron.
  if (tienePlus) return digits;

  // Si arranca con 54 (con o sin 9), confiamos.
  if (digits.startsWith("54")) {
    // Insertar 9 si falta (54 11 XXXX → 5491 1XXXX)
    if (digits.length >= 12 && digits[2] !== "9") {
      return "549" + digits.slice(2);
    }
    return digits;
  }

  // Sin código de país: asumimos AR móvil → 549 + (sin 0 inicial)
  const sinCero = digits.startsWith("0") ? digits.slice(1) : digits;
  // Sin 15 inicial (vieja convención AR de móvil)
  const sin15 = sinCero.startsWith("15") ? sinCero.slice(2) : sinCero;
  return "549" + sin15;
}
