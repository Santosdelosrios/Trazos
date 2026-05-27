import { describe, it, expect } from "vitest";
import { armarDatosComprobante, type InputBuilder } from "./datosComprobante";

const baseInput = (over: Partial<InputBuilder> = {}): InputBuilder => ({
  pago: {
    id: "pago-1",
    monto: 5000,
    estado: "pagado",
    medio_pago: "efectivo",
    fecha_pago: "2026-05-20",
    nota: null,
    clase_id: null,
    created_at: "2026-05-20T10:00:00Z",
  },
  maestra: { nombre: "Profe Demo", datos_pago: null },
  alumno: { nombre: "Sofía", apellido: "Pérez", familia_nombre: null },
  claseAsociada: null,
  imputaciones: [],
  ...over,
});

describe("armarDatosComprobante", () => {
  describe("priorización de líneas", () => {
    it("usa imputaciones cuando existen (cobro parcial con FIFO)", () => {
      const res = armarDatosComprobante(
        baseInput({
          pago: { ...baseInput().pago, monto: 8000, estado: "parcial" },
          imputaciones: [
            { clase_id: "c1", monto_imputado: 3000, fecha: "2026-05-08", tema: "Mate" },
            { clase_id: "c2", monto_imputado: 5000, fecha: "2026-05-15", tema: "Lengua" },
          ],
        })
      );
      expect(res.lineas).toHaveLength(2);
      expect(res.lineas[0]).toMatchObject({ tema: "Mate", monto: 3000, fecha: "2026-05-08" });
      expect(res.total).toBe(8000);
    });

    it("usa la clase asociada cuando no hay imputaciones", () => {
      const res = armarDatosComprobante(
        baseInput({
          pago: { ...baseInput().pago, monto: 5000, clase_id: "c1" },
          claseAsociada: { fecha: "2026-05-10", tema: "Matemática" },
        })
      );
      expect(res.lineas).toHaveLength(1);
      expect(res.lineas[0]).toMatchObject({ tema: "Matemática", monto: 5000, fecha: "2026-05-10" });
      expect(res.total).toBe(5000);
    });

    it("devuelve líneas vacías y total = monto cuando no hay clase ni imputaciones", () => {
      const res = armarDatosComprobante(
        baseInput({ pago: { ...baseInput().pago, monto: 12000 } })
      );
      expect(res.lineas).toHaveLength(0);
      expect(res.total).toBe(12000);
    });
  });

  describe("normalización de fecha", () => {
    it("recorta timestamp ISO a YYYY-MM-DD", () => {
      const res = armarDatosComprobante(
        baseInput({
          imputaciones: [
            { clase_id: "c1", monto_imputado: 100, fecha: "2026-05-08T15:00:00.000Z", tema: "x" },
          ],
        })
      );
      expect(res.lineas[0].fecha).toBe("2026-05-08");
    });

    it("respeta una fecha YYYY-MM-DD ya corta", () => {
      const res = armarDatosComprobante(
        baseInput({
          claseAsociada: { fecha: "2026-05-08", tema: "x" },
          pago: { ...baseInput().pago, clase_id: "c1" },
        })
      );
      expect(res.lineas[0].fecha).toBe("2026-05-08");
    });
  });

  describe("propagación de metadata", () => {
    it("propaga datos del alumno y familia", () => {
      const res = armarDatosComprobante(
        baseInput({
          alumno: { nombre: "Sofía", apellido: "Pérez", familia_nombre: "Familia Pérez" },
        })
      );
      expect(res.alumno.familia_nombre).toBe("Familia Pérez");
    });

    it("propaga datos de la maestra (nombre y datos de pago)", () => {
      const res = armarDatosComprobante(
        baseInput({
          maestra: { nombre: "María", datos_pago: "Alias: maria.profe" },
        })
      );
      expect(res.maestra).toEqual({ nombre: "María", datos_pago: "Alias: maria.profe" });
    });

    it("propaga estado, medio_pago, fecha y nota del pago", () => {
      const res = armarDatosComprobante(
        baseInput({
          pago: {
            ...baseInput().pago,
            estado: "parcial",
            medio_pago: "transferencia",
            fecha_pago: "2026-04-15",
            nota: "Transfirió desde MP",
          },
        })
      );
      expect(res.pago.estado).toBe("parcial");
      expect(res.pago.medio_pago).toBe("transferencia");
      expect(res.pago.fecha_pago).toBe("2026-04-15");
      expect(res.pago.nota).toBe("Transfirió desde MP");
    });
  });

  describe("fallbacks de tema", () => {
    it("usa 'Clase' cuando una imputación viene sin tema", () => {
      const res = armarDatosComprobante(
        baseInput({
          imputaciones: [
            { clase_id: "c1", monto_imputado: 500, fecha: "2026-05-08", tema: "" },
          ],
        })
      );
      expect(res.lineas[0].tema).toBe("Clase");
    });

    it("usa 'Clase' cuando la clase asociada viene sin tema", () => {
      const res = armarDatosComprobante(
        baseInput({
          pago: { ...baseInput().pago, clase_id: "c1" },
          claseAsociada: { fecha: "2026-05-08", tema: "" },
        })
      );
      expect(res.lineas[0].tema).toBe("Clase");
    });
  });
});
