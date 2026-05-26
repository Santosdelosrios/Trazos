import { describe, it, expect } from "vitest";
import { armarDesgloseFamilia, desgloseATextoWhatsApp } from "./desglose";
import type { DetalleFamiliaItem } from "@/lib/types/database";

const mkItem = (over: Partial<DetalleFamiliaItem> = {}): DetalleFamiliaItem => ({
  alumno_id: "uuid-" + Math.random(),
  nombre: "Sofía",
  apellido: "Pérez",
  modelo_cobro: "por_clase",
  saldo_actual: 0,
  tarifa_efectiva: 5000,
  ...over,
});

describe("armarDesgloseFamilia", () => {
  it("suma solo deuda monetaria: por_clase + cuenta_corriente + abono_mensual", () => {
    const items: DetalleFamiliaItem[] = [
      mkItem({ saldo_actual: 1000, modelo_cobro: "por_clase" }),
      mkItem({ saldo_actual: 500, modelo_cobro: "abono_mensual" }),
      mkItem({ saldo_actual: 250, modelo_cobro: "cuenta_corriente" }),
    ];
    const { lineas, totalDeuda } = armarDesgloseFamilia(items);
    expect(totalDeuda).toBe(1750);
    expect(lineas).toHaveLength(3);
    expect(lineas.every((l) => l.es_deuda_monetaria)).toBe(true);
  });

  it("excluye bolsa_creditos del total (saldo positivo = créditos a favor, no deuda)", () => {
    const items: DetalleFamiliaItem[] = [
      mkItem({ saldo_actual: 1000, modelo_cobro: "por_clase" }),
      mkItem({ saldo_actual: 8, modelo_cobro: "bolsa_creditos" }),
    ];
    const { lineas, totalDeuda } = armarDesgloseFamilia(items);
    expect(totalDeuda).toBe(1000);
    expect(lineas).toHaveLength(2);
    expect(lineas[1].es_deuda_monetaria).toBe(false);
  });

  it("considera saldo negativo como saldo a favor (resta del total)", () => {
    const items: DetalleFamiliaItem[] = [
      mkItem({ saldo_actual: 1000, modelo_cobro: "por_clase", nombre: "Sofía" }),
      mkItem({ saldo_actual: -300, modelo_cobro: "cuenta_corriente", nombre: "Tomás" }),
    ];
    const { totalDeuda } = armarDesgloseFamilia(items);
    expect(totalDeuda).toBe(700);
  });
});

describe("desgloseATextoWhatsApp", () => {
  it("formatea una línea por alumno con saldo > 0", () => {
    const items: DetalleFamiliaItem[] = [
      mkItem({ nombre: "Sofía", apellido: "Pérez", saldo_actual: 5000 }),
      mkItem({ nombre: "Tomás", apellido: "Pérez", saldo_actual: 3500 }),
    ];
    const { lineas } = armarDesgloseFamilia(items);
    const texto = desgloseATextoWhatsApp(lineas);
    expect(texto.split("\n")).toHaveLength(2);
    expect(texto).toContain("Sofía Pérez");
    expect(texto).toContain("Tomás Pérez");
  });

  it("omite alumnos con saldo 0", () => {
    const items: DetalleFamiliaItem[] = [
      mkItem({ nombre: "Sofía", apellido: "Pérez", saldo_actual: 5000 }),
      mkItem({ nombre: "Tomás", apellido: "Pérez", saldo_actual: 0 }),
    ];
    const { lineas } = armarDesgloseFamilia(items);
    const texto = desgloseATextoWhatsApp(lineas);
    expect(texto.split("\n")).toHaveLength(1);
    expect(texto).toContain("Sofía");
    expect(texto).not.toContain("Tomás");
  });

  it("omite alumnos con bolsa_creditos aunque tengan saldo", () => {
    const items: DetalleFamiliaItem[] = [
      mkItem({ nombre: "Sofía", saldo_actual: 5, modelo_cobro: "bolsa_creditos" }),
    ];
    const { lineas } = armarDesgloseFamilia(items);
    const texto = desgloseATextoWhatsApp(lineas);
    expect(texto).toBe("");
  });
});
