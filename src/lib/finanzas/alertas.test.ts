import { describe, it, expect } from "vitest";
import { presentarAlerta, variacionPorcentual } from "./alertas";
import type { AlertaFinanza } from "@/lib/types/database";

const mk = (over: Partial<AlertaFinanza>): AlertaFinanza => ({
  tipo: "alumno_deuda_15d",
  severidad: "warning",
  payload: {},
  ...over,
});

describe("presentarAlerta", () => {
  describe("alumno_deuda_15d", () => {
    it("arma título con saldo formateado y descripción con días", () => {
      const p = presentarAlerta(mk({
        tipo: "alumno_deuda_15d",
        severidad: "warning",
        payload: {
          alumno_id: "uuid-1",
          nombre: "Sofía Pérez",
          saldo: 12500,
          dias_desde_ultima_clase: 22,
        },
      }));
      expect(p.titulo).toContain("Sofía Pérez");
      expect(p.titulo).toMatch(/12\.500/);
      expect(p.descripcion).toContain("22 días");
      expect(p.cta?.href).toBe("/alumnos/uuid-1");
    });

    it("usa CTA genérico cuando no hay alumno_id", () => {
      const p = presentarAlerta(mk({
        tipo: "alumno_deuda_15d",
        payload: { nombre: "X", saldo: 100, dias_desde_ultima_clase: 30 },
      }));
      expect(p.cta?.href).toBe("/finanzas/cuentas");
    });

    it("omite los días en la descripción si dias = 0", () => {
      const p = presentarAlerta(mk({
        tipo: "alumno_deuda_15d",
        payload: { nombre: "X", saldo: 100, dias_desde_ultima_clase: 0 },
      }));
      expect(p.descripcion).not.toContain("días");
    });
  });

  it("cobro_pendiente_30d incluye monto, alumno y días", () => {
    const p = presentarAlerta(mk({
      tipo: "cobro_pendiente_30d",
      severidad: "critical",
      payload: { alumno: "Tomás Pérez", monto: 5000, dias: 45 },
    }));
    expect(p.titulo).toContain("45 días");
    expect(p.descripcion).toContain("Tomás Pérez");
    expect(p.descripcion).toMatch(/5\.000/);
    expect(p.cta?.href).toBe("/finanzas/cobranzas");
    expect(p.tono.iconColor).toContain("danger");
  });

  it("tarifa_desactualizada incluye meses y valor", () => {
    const p = presentarAlerta(mk({
      tipo: "tarifa_desactualizada",
      severidad: "info",
      payload: { meses: 4.5, valor_hora: 8000 },
    }));
    expect(p.descripcion).toContain("4.5 meses");
    expect(p.descripcion).toMatch(/8\.000/);
    expect(p.cta?.href).toBe("/finanzas/tarifas");
  });

  it("caida_facturacion_20pct incluye comparativa con mes anterior", () => {
    const p = presentarAlerta(mk({
      tipo: "caida_facturacion_20pct",
      severidad: "critical",
      payload: { actual: 20000, anterior: 50000, caida_pct: 60 },
    }));
    expect(p.titulo).toContain("60%");
    expect(p.descripcion).toMatch(/20\.000/);
    expect(p.descripcion).toMatch(/50\.000/);
    expect(p.cta?.href).toBe("/finanzas/historico");
  });

  it("severidad info aplica tono primary", () => {
    const p = presentarAlerta(mk({ severidad: "info" }));
    expect(p.tono.bg).toContain("primary");
  });

  it("severidad critical aplica tono danger", () => {
    const p = presentarAlerta(mk({ severidad: "critical" }));
    expect(p.tono.bg).toContain("danger");
  });
});

describe("variacionPorcentual", () => {
  it("calcula incremento positivo correctamente", () => {
    expect(variacionPorcentual(150, 100)).toBe(50);
    expect(variacionPorcentual(200, 100)).toBe(100);
  });

  it("calcula caída como negativo", () => {
    expect(variacionPorcentual(80, 100)).toBe(-20);
    expect(variacionPorcentual(50, 100)).toBe(-50);
  });

  it("redondea al entero más cercano", () => {
    expect(variacionPorcentual(133, 100)).toBe(33);
    expect(variacionPorcentual(666, 1000)).toBe(-33);
  });

  it("devuelve 0 si ambos son 0", () => {
    expect(variacionPorcentual(0, 0)).toBe(0);
  });

  it("devuelve null si anterior es 0 pero actual no (sin punto de comparación)", () => {
    expect(variacionPorcentual(1000, 0)).toBeNull();
  });
});
