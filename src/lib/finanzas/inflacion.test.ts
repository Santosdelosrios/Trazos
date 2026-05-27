import { describe, it, expect } from "vitest";
import {
  calcularSugerencia,
  redondearTarifa,
  mesesEntreFechas,
} from "./inflacion";

describe("redondearTarifa", () => {
  it("usa pasos de 50 cuando es < 1000", () => {
    expect(redondearTarifa(823)).toBe(850);
    expect(redondearTarifa(800)).toBe(800);
    expect(redondearTarifa(801)).toBe(850);
  });

  it("usa pasos de 100 cuando está entre 1000 y 10000", () => {
    expect(redondearTarifa(4567)).toBe(4600);
    expect(redondearTarifa(5000)).toBe(5000);
    expect(redondearTarifa(5001)).toBe(5100);
  });

  it("usa pasos de 500 cuando es >= 10000", () => {
    expect(redondearTarifa(12345)).toBe(12500);
    expect(redondearTarifa(10000)).toBe(10000);
    expect(redondearTarifa(10001)).toBe(10500);
  });

  it("siempre redondea hacia arriba (nunca por debajo de la inflación real)", () => {
    expect(redondearTarifa(5042)).toBeGreaterThanOrEqual(5042);
    expect(redondearTarifa(12347)).toBeGreaterThanOrEqual(12347);
  });

  it("devuelve 0 para entrada <= 0", () => {
    expect(redondearTarifa(0)).toBe(0);
    expect(redondearTarifa(-100)).toBe(0);
  });
});

describe("calcularSugerencia", () => {
  it("aplica el factor 1+inflación a la tarifa actual", () => {
    const s = calcularSugerencia({
      tarifaActual: 5000,
      inflacionAcumulada: 0.20, // 20%
      meses: 3,
    });
    // 5000 × 1.20 = 6000 (ya es múltiplo de 100)
    expect(s.sugerida).toBe(6000);
    expect(s.actual).toBe(5000);
    expect(s.meses).toBe(3);
  });

  it("convierte la fracción decimal a % con 1 decimal", () => {
    const s = calcularSugerencia({
      tarifaActual: 1000,
      inflacionAcumulada: 0.123, // 12.3%
      meses: 1,
    });
    expect(s.inflacionPct).toBe(12.3);
  });

  it("redondea el sugerido al múltiplo correspondiente", () => {
    // 5000 × 1.0420 = 5210 → debería redondear a 5300 (paso 100)
    const s = calcularSugerencia({
      tarifaActual: 5000,
      inflacionAcumulada: 0.0420,
      meses: 1,
    });
    expect(s.sugerida).toBe(5300);
  });

  it("trata inflación negativa como 0 (no baja la tarifa)", () => {
    const s = calcularSugerencia({
      tarifaActual: 5000,
      inflacionAcumulada: -0.05,
      meses: 2,
    });
    expect(s.sugerida).toBe(5000);
  });

  it("calcula correctamente con inflación alta acumulada (caso AR realista)", () => {
    // 12 meses con ~5% mensual compuesto ≈ 79.5% acumulado
    const s = calcularSugerencia({
      tarifaActual: 10000,
      inflacionAcumulada: 0.795,
      meses: 12,
    });
    // 10000 × 1.795 = 17950 → redondea a 18000 (paso 500 porque >= 10000)
    expect(s.sugerida).toBe(18000);
  });

  it("maneja meses = 0 (sin tiempo transcurrido)", () => {
    const s = calcularSugerencia({
      tarifaActual: 5000,
      inflacionAcumulada: 0,
      meses: 0,
    });
    expect(s.meses).toBe(0);
    expect(s.sugerida).toBe(5000);
  });
});

describe("mesesEntreFechas", () => {
  it("calcula meses completos transcurridos", () => {
    expect(mesesEntreFechas("2024-01-15", new Date("2024-04-15T12:00:00Z"))).toBe(3);
    expect(mesesEntreFechas("2024-01-15", new Date("2024-04-16T12:00:00Z"))).toBe(3);
  });

  it("no cuenta el mes si todavía no se cumplió el día", () => {
    expect(mesesEntreFechas("2024-01-15", new Date("2024-04-10T12:00:00Z"))).toBe(2);
  });

  it("devuelve 0 si la fecha es futura o muy reciente", () => {
    expect(mesesEntreFechas("2026-01-01", new Date("2025-12-31T12:00:00Z"))).toBe(0);
  });

  it("cruza años correctamente", () => {
    expect(mesesEntreFechas("2023-06-01", new Date("2024-06-01T12:00:00Z"))).toBe(12);
  });

  it("acepta formato corto YYYY-MM-DD sin hora", () => {
    // Mismo resultado que con hora explícita
    expect(mesesEntreFechas("2024-01-15", new Date("2024-07-15T12:00:00Z"))).toBe(6);
  });
});
