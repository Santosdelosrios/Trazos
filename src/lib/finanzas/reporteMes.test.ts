import { describe, it, expect } from "vitest";
import { normalizarReporte, nombreMes } from "./reporteMes";

describe("nombreMes", () => {
  it("devuelve el nombre del mes en español", () => {
    expect(nombreMes(1)).toBe("enero");
    expect(nombreMes(5)).toBe("mayo");
    expect(nombreMes(12)).toBe("diciembre");
  });

  it("clamp para entradas fuera de rango", () => {
    expect(nombreMes(0)).toBe("enero");
    expect(nombreMes(13)).toBe("diciembre");
    expect(nombreMes(-1)).toBe("enero");
  });
});

describe("normalizarReporte", () => {
  const rawCompleto = {
    periodo: { anio: 2026, mes: 5, desde: "2026-05-01", hasta: "2026-05-31" },
    resumen: { ingresos: "100000", gastos: "30000", neto: "70000", cant_pagos: 12, cant_gastos: 5 },
    comparativo: {
      ingresos_anterior: "80000", gastos_anterior: "25000", neto_anterior: "55000",
      var_ingresos_pct: 25, var_neto_pct: 27,
    },
    top_alumnos: [
      { nombre: "Sofía Pérez", total: "30000", cant_clases: "4" },
      { nombre: "Tomás López", total: "25000", cant_clases: "3" },
    ],
    top_familias: [{ nombre: "Familia Pérez", total: "55000" }],
    gastos_por_categoria: [
      { nombre: "Materiales", total: "20000", cant: "3" },
      { nombre: "Transporte", total: "10000", cant: "2" },
    ],
  };

  it("convierte string numéricos a number (postgrest numeric quirk)", () => {
    const r = normalizarReporte(rawCompleto, "Profe María");
    expect(r.resumen.ingresos).toBe(100000);
    expect(r.resumen.neto).toBe(70000);
    expect(r.top_alumnos[0].total).toBe(30000);
    expect(r.top_alumnos[0].cant_clases).toBe(4);
    expect(r.gastos_por_categoria[0].cant).toBe(3);
  });

  it("propaga el nombre de la maestra desde el segundo argumento", () => {
    const r = normalizarReporte(rawCompleto, "Profe María");
    expect(r.maestra.nombre).toBe("Profe María");
  });

  it("acepta var_ingresos_pct null cuando no hay base comparable", () => {
    const r = normalizarReporte({
      ...rawCompleto,
      comparativo: { ...rawCompleto.comparativo, var_ingresos_pct: null, var_neto_pct: null },
    }, "X");
    expect(r.comparativo.var_ingresos_pct).toBeNull();
    expect(r.comparativo.var_neto_pct).toBeNull();
  });

  it("defaults a 0 / arrays vacíos cuando faltan campos", () => {
    const r = normalizarReporte({}, "X");
    expect(r.resumen.ingresos).toBe(0);
    expect(r.top_alumnos).toEqual([]);
    expect(r.top_familias).toEqual([]);
    expect(r.gastos_por_categoria).toEqual([]);
  });

  it("preserva el orden de los arrays (ya vienen ordenados de la RPC)", () => {
    const r = normalizarReporte(rawCompleto, "X");
    expect(r.top_alumnos[0].nombre).toBe("Sofía Pérez");
    expect(r.top_alumnos[1].nombre).toBe("Tomás López");
  });
});
