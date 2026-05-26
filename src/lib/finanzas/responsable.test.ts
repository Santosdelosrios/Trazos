import { describe, it, expect } from "vitest";
import {
  normalizarTelefonoAR,
  obtenerResponsableContacto,
} from "./responsable";

describe("normalizarTelefonoAR", () => {
  it("devuelve null para entradas vacías o demasiado cortas", () => {
    expect(normalizarTelefonoAR(null)).toBeNull();
    expect(normalizarTelefonoAR(undefined)).toBeNull();
    expect(normalizarTelefonoAR("")).toBeNull();
    expect(normalizarTelefonoAR("123")).toBeNull();
  });

  it("respeta un número con prefijo + (código de país arbitrario)", () => {
    expect(normalizarTelefonoAR("+1 555 234 5678")).toBe("15552345678");
    expect(normalizarTelefonoAR("+34 600 123 456")).toBe("34600123456");
  });

  it("agrega el 9 si el número arranca con 54 sin móvil", () => {
    // Fijo: 54 11 4123 4567 → móvil correcto: 5491141234567
    expect(normalizarTelefonoAR("54 11 4123 4567")).toBe("5491141234567");
  });

  it("respeta el número si ya arranca con 549", () => {
    expect(normalizarTelefonoAR("549 11 4123 4567")).toBe("5491141234567");
  });

  it("convierte un número AR sin código de país a formato wa.me", () => {
    expect(normalizarTelefonoAR("11 2345 6789")).toBe("5491123456789");
    expect(normalizarTelefonoAR("(011) 2345-6789")).toBe("5491123456789");
  });

  it("quita el 15 inicial de la vieja convención móvil", () => {
    expect(normalizarTelefonoAR("15 2345 6789")).toBe("54923456789");
  });

  it("quita el 0 inicial cuando arranca con 0", () => {
    expect(normalizarTelefonoAR("011 2345 6789")).toBe("5491123456789");
  });
});

describe("obtenerResponsableContacto", () => {
  it("prioriza familia sobre alumno cuando hay ambos", () => {
    const res = obtenerResponsableContacto({
      responsable_nombre: "Papá Alumno",
      responsable_telefono: "11 1111 1111",
      familia: {
        responsable_nombre: "Mamá Familia",
        responsable_telefono: "11 2222 2222",
      },
    });
    expect(res.origen).toBe("familia");
    expect(res.nombre).toBe("Mamá Familia");
    expect(res.telefono).toBe("5491122222222");
  });

  it("usa el alumno cuando la familia no tiene teléfono ni nombre", () => {
    const res = obtenerResponsableContacto({
      responsable_nombre: "Papá Alumno",
      responsable_telefono: "11 1111 1111",
      familia: null,
    });
    expect(res.origen).toBe("alumno");
    expect(res.nombre).toBe("Papá Alumno");
    expect(res.telefono).toBe("5491111111111");
  });

  it("devuelve null cuando no hay ningún dato", () => {
    const res = obtenerResponsableContacto({
      responsable_nombre: null,
      responsable_telefono: null,
      familia: null,
    });
    expect(res.origen).toBeNull();
    expect(res.nombre).toBeNull();
    expect(res.telefono).toBeNull();
  });

  it("normaliza incluso si el teléfono viene mal formateado", () => {
    const res = obtenerResponsableContacto({
      responsable_nombre: null,
      responsable_telefono: null,
      familia: {
        responsable_nombre: "Resp",
        responsable_telefono: "(11) 2345-6789",
      },
    });
    expect(res.telefono).toBe("5491123456789");
  });
});
