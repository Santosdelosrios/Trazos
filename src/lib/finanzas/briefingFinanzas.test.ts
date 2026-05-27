import { describe, it, expect } from "vitest";
import {
  briefingFallback,
  buildPromptBriefing,
  type ContextoBriefingFinanzas,
} from "./briefingFinanzas";

const ctx = (over: Partial<ContextoBriefingFinanzas> = {}): ContextoBriefingFinanzas => ({
  nombreMaestra: "María",
  mes: "mayo",
  anio: 2026,
  ingresosMes: 100000,
  gastosMes: 20000,
  netoMes: 80000,
  proyectado: 150000,
  deudores: {
    count: 2,
    total: 15000,
    top: [
      { nombre: "Sofía Pérez", monto: 10000 },
      { nombre: "Tomás López", monto: 5000 },
    ],
  },
  mejorAlumno: { nombre: "Sofía Pérez", total: 25000 },
  ingresosMesAnterior: 80000,
  variacionPct: 25,
  ...over,
});

describe("briefingFallback", () => {
  it("usa el nombre de la maestra en el saludo", () => {
    const b = briefingFallback(ctx());
    expect(b.saludo).toContain("María");
    expect(b.saludo).toContain("mayo");
  });

  it("incluye monto facturado en el saludo", () => {
    const b = briefingFallback(ctx());
    expect(b.saludo).toMatch(/100\.000/);
  });

  it("muestra variación positiva con + prefix", () => {
    const b = briefingFallback(ctx({ variacionPct: 25 }));
    expect(b.saludo).toContain("+25%");
  });

  it("muestra variación negativa sin reformatear", () => {
    const b = briefingFallback(ctx({ variacionPct: -15 }));
    expect(b.saludo).toContain("-15%");
  });

  it("omite la variación cuando no hay base comparable", () => {
    const b = briefingFallback(ctx({ variacionPct: null }));
    expect(b.saludo).not.toContain("%");
  });

  it("destaca al mejor alumno cuando existe", () => {
    const b = briefingFallback(ctx());
    expect(b.destacado).toContain("Sofía Pérez");
    expect(b.destacado).toMatch(/25\.000/);
  });

  it("usa un genérico cuando no hay mejor alumno", () => {
    const b = briefingFallback(ctx({ mejorAlumno: null }));
    expect(b.destacado).not.toContain("Sofía");
    expect(b.destacado.length).toBeGreaterThan(0);
  });

  it("acción sugiere recordatorios cuando hay deudores", () => {
    const b = briefingFallback(ctx());
    expect(b.accion_sugerida).toContain("recordatorios");
    expect(b.accion_sugerida).toMatch(/15\.000/);
  });

  it("acción usa singular 'alumno' cuando count = 1", () => {
    const b = briefingFallback(ctx({
      deudores: { count: 1, total: 5000, top: [{ nombre: "X", monto: 5000 }] },
    }));
    expect(b.accion_sugerida).toContain("1 alumno");
    expect(b.accion_sugerida).not.toContain("alumnos");
  });

  it("acción menciona proyección cuando no hay deudores pero hay potencial", () => {
    const b = briefingFallback(ctx({
      deudores: { count: 0, total: 0, top: [] },
      ingresosMes: 50000,
      proyectado: 120000,
    }));
    expect(b.accion_sugerida).toMatch(/120\.000/);
  });

  it("acción es neutra cuando no hay deudores ni potencial extra", () => {
    const b = briefingFallback(ctx({
      deudores: { count: 0, total: 0, top: [] },
      ingresosMes: 100000,
      proyectado: 100000,
    }));
    expect(b.accion_sugerida).toBe("Seguí así.");
  });
});

describe("buildPromptBriefing", () => {
  it("incluye el nombre de la maestra y el mes", () => {
    const p = buildPromptBriefing(ctx());
    expect(p).toContain("María");
    expect(p).toContain("MAYO 2026");
  });

  it("incluye los números clave formateados en es-AR", () => {
    const p = buildPromptBriefing(ctx());
    expect(p).toMatch(/100\.000/);
    expect(p).toMatch(/15\.000/);
    expect(p).toMatch(/25\.000/);
  });

  it("pide JSON estructurado con los 3 campos", () => {
    const p = buildPromptBriefing(ctx());
    expect(p).toContain('"saludo"');
    expect(p).toContain('"destacado"');
    expect(p).toContain('"accion_sugerida"');
  });

  it("instruye tono Trazos (voseo, cálido, sin emojis excepto al final)", () => {
    const p = buildPromptBriefing(ctx());
    expect(p.toLowerCase()).toContain("voseo");
    expect(p.toLowerCase()).toContain("trazos");
  });

  it("omite líneas opcionales cuando los datos no están", () => {
    const p = buildPromptBriefing(ctx({ mejorAlumno: null, variacionPct: null }));
    expect(p).not.toContain("mejor alumno");
    expect(p).not.toContain("Variación vs");
  });
});
