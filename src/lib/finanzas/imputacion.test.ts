import { describe, it, expect } from "vitest";
import {
  armarImputacionFIFO,
  validarImputacionManual,
  type ClasePendienteImputacion,
} from "./imputacion";

const clase = (over: Partial<ClasePendienteImputacion> = {}): ClasePendienteImputacion => ({
  clase_id: over.clase_id ?? "c-" + Math.random().toString(36).slice(2, 7),
  fecha: over.fecha ?? "2026-05-15",
  tema: over.tema ?? "Tema",
  monto_total: over.monto_total ?? 1000,
  monto_imputado: over.monto_imputado ?? 0,
  pendiente: over.pendiente ?? 1000,
});

describe("armarImputacionFIFO", () => {
  it("reparte el monto entre clases en orden de fecha asc", () => {
    const clases = [
      clase({ clase_id: "c2", fecha: "2026-04-20", pendiente: 1000 }),
      clase({ clase_id: "c1", fecha: "2026-04-10", pendiente: 1500 }),
      clase({ clase_id: "c3", fecha: "2026-05-01", pendiente: 1000 }),
    ];
    const { lineas, saldo_a_favor } = armarImputacionFIFO(clases, 2000);
    expect(saldo_a_favor).toBe(0);
    expect(lineas).toEqual([
      { clase_id: "c1", monto_imputado: 1500 },
      { clase_id: "c2", monto_imputado: 500 },
    ]);
  });

  it("cubre completamente la primera clase antes de pasar a la siguiente", () => {
    const clases = [
      clase({ clase_id: "c1", fecha: "2026-04-10", pendiente: 800 }),
      clase({ clase_id: "c2", fecha: "2026-04-20", pendiente: 800 }),
    ];
    const { lineas, saldo_a_favor } = armarImputacionFIFO(clases, 800);
    expect(saldo_a_favor).toBe(0);
    expect(lineas).toEqual([{ clase_id: "c1", monto_imputado: 800 }]);
  });

  it("devuelve saldo_a_favor si el monto excede el pendiente total", () => {
    const clases = [clase({ pendiente: 500 })];
    const { lineas, saldo_a_favor } = armarImputacionFIFO(clases, 2000);
    expect(saldo_a_favor).toBe(1500);
    expect(lineas).toHaveLength(1);
    expect(lineas[0].monto_imputado).toBe(500);
  });

  it("ignora clases sin pendiente", () => {
    const clases = [
      clase({ clase_id: "c1", pendiente: 0 }),
      clase({ clase_id: "c2", pendiente: 700, fecha: "2026-05-01" }),
    ];
    const { lineas } = armarImputacionFIFO(clases, 500);
    expect(lineas).toEqual([{ clase_id: "c2", monto_imputado: 500 }]);
  });

  it("retorna vacío si el monto es 0 o negativo", () => {
    const clases = [clase({ pendiente: 1000 })];
    expect(armarImputacionFIFO(clases, 0)).toEqual({ lineas: [], saldo_a_favor: 0 });
    expect(armarImputacionFIFO(clases, -100)).toEqual({ lineas: [], saldo_a_favor: 0 });
  });

  it("retorna vacío con lista de clases vacía y saldo a favor por todo el monto", () => {
    const { lineas, saldo_a_favor } = armarImputacionFIFO([], 1500);
    expect(lineas).toEqual([]);
    expect(saldo_a_favor).toBe(1500);
  });
});

describe("validarImputacionManual", () => {
  const clases = [
    clase({ clase_id: "c1", pendiente: 1000 }),
    clase({ clase_id: "c2", pendiente: 500 }),
  ];

  it("acepta una distribución válida y devuelve saldo a favor 0", () => {
    const res = validarImputacionManual(
      clases,
      [
        { clase_id: "c1", monto_imputado: 1000 },
        { clase_id: "c2", monto_imputado: 500 },
      ],
      1500
    );
    expect(res.saldo_a_favor).toBe(0);
  });

  it("acepta distribución que deja saldo a favor", () => {
    const res = validarImputacionManual(
      clases,
      [{ clase_id: "c1", monto_imputado: 1000 }],
      1500
    );
    expect(res.saldo_a_favor).toBe(500);
  });

  it("rechaza monto total 0 o negativo", () => {
    expect(() => validarImputacionManual(clases, [], 0)).toThrow(/mayor a 0/);
    expect(() => validarImputacionManual(clases, [], -100)).toThrow(/mayor a 0/);
  });

  it("rechaza una imputación con monto <= 0", () => {
    expect(() =>
      validarImputacionManual(clases, [{ clase_id: "c1", monto_imputado: 0 }], 1000)
    ).toThrow(/mayores a 0/);
  });

  it("rechaza imputación a clase que no existe", () => {
    expect(() =>
      validarImputacionManual(clases, [{ clase_id: "c-fantasma", monto_imputado: 100 }], 1000)
    ).toThrow(/no está en la lista/);
  });

  it("rechaza imputar más que el pendiente de la clase", () => {
    expect(() =>
      validarImputacionManual(clases, [{ clase_id: "c2", monto_imputado: 600 }], 1000)
    ).toThrow(/quedaban/);
  });

  it("rechaza si la suma de imputaciones excede el monto del pago", () => {
    expect(() =>
      validarImputacionManual(
        clases,
        [
          { clase_id: "c1", monto_imputado: 1000 },
          { clase_id: "c2", monto_imputado: 500 },
        ],
        1000
      )
    ).toThrow(/suman.*pago/);
  });
});
