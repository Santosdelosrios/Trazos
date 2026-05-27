import { describe, it, expect } from "vitest";
import { agruparGastosTopN } from "./agruparGastos";
import type { GastoPorCategoriaMes } from "@/lib/types/database";

const it1 = (nombre: string, total: number, cant = 1): GastoPorCategoriaMes => ({
  categoria_id: `cat-${nombre}`,
  nombre,
  icono: null,
  total,
  cant,
});

describe("agruparGastosTopN", () => {
  it("devuelve items sin cambios cuando hay <= topN", () => {
    const items = [it1("A", 1000), it1("B", 500)];
    const filas = agruparGastosTopN(items, 5);
    expect(filas).toHaveLength(2);
    expect(filas.every((f) => f.agrupada === false)).toBe(true);
    expect(filas[0].nombre).toBe("A");
  });

  it("agrega 'Otros (N)' con suma del resto cuando hay > topN", () => {
    const items = [
      it1("A", 1000, 3),
      it1("B", 500, 2),
      it1("C", 300, 1),
      it1("D", 200, 1),
    ];
    const filas = agruparGastosTopN(items, 2);
    expect(filas).toHaveLength(3);
    expect(filas[2]).toMatchObject({
      nombre: "Otros (2)",
      total: 500, // 300 + 200
      cant: 2,    // 1 + 1
      agrupada: true,
    });
  });

  it("respeta el orden de entrada (FIFO)", () => {
    const items = [it1("Z", 1000), it1("A", 100)];
    const filas = agruparGastosTopN(items, 5);
    expect(filas[0].nombre).toBe("Z");
    expect(filas[1].nombre).toBe("A");
  });

  it("topN = 0 colapsa todo en 'Otros'", () => {
    const items = [it1("A", 100), it1("B", 200)];
    const filas = agruparGastosTopN(items, 0);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      nombre: "Otros (2)",
      total: 300,
      cant: 2,
      agrupada: true,
    });
  });

  it("lista vacía devuelve array vacío", () => {
    expect(agruparGastosTopN([], 5)).toEqual([]);
  });

  it("convierte strings numéricos a número (Supabase puede devolver numeric como string)", () => {
    const items: GastoPorCategoriaMes[] = [
      // Simulamos lo que llega del wire: total/cant como strings
      { categoria_id: "x", nombre: "A", icono: null, total: "1500" as unknown as number, cant: "3" as unknown as number },
    ];
    const filas = agruparGastosTopN(items, 5);
    expect(filas[0].total).toBe(1500);
    expect(filas[0].cant).toBe(3);
  });
});
