import { describe, it, expect } from "vitest";
import {
  CrearAlumnoSchema,
  ActualizarAlumnoSchema,
  RegistrarPagoSchema,
  RegistrarGastoSchema,
  GuardarTarifaSchema,
  CargarCreditosSchema,
} from "./schemas";

describe("schemas zod", () => {
  describe("CrearAlumnoSchema", () => {
    it("acepta input válido", () => {
      const result = CrearAlumnoSchema.safeParse({
        nombre: "María",
        apellido: "García",
        grado: "5to grado",
        notas: "Le cuesta fracciones",
      });
      expect(result.success).toBe(true);
    });

    it("acepta nombres con acentos y ñ", () => {
      const result = CrearAlumnoSchema.safeParse({
        nombre: "Iñaki",
        apellido: "Núñez",
        grado: "Primaria",
      });
      expect(result.success).toBe(true);
    });

    it("acepta apellidos compuestos con espacio o guion", () => {
      const r1 = CrearAlumnoSchema.safeParse({
        nombre: "Ana",
        apellido: "De La Rosa",
        grado: "Secundaria",
      });
      expect(r1.success).toBe(true);

      const r2 = CrearAlumnoSchema.safeParse({
        nombre: "Juan",
        apellido: "Pérez-López",
        grado: "Secundaria",
      });
      expect(r2.success).toBe(true);
    });

    it("rechaza nombre vacío", () => {
      const result = CrearAlumnoSchema.safeParse({
        nombre: "",
        apellido: "García",
        grado: "5to",
      });
      expect(result.success).toBe(false);
    });

    it("rechaza nombre con números o símbolos sospechosos", () => {
      const result = CrearAlumnoSchema.safeParse({
        nombre: "Juan123",
        apellido: "García",
        grado: "5to",
      });
      expect(result.success).toBe(false);
    });

    it("rechaza grado vacío", () => {
      const result = CrearAlumnoSchema.safeParse({
        nombre: "Juan",
        apellido: "García",
        grado: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ActualizarAlumnoSchema", () => {
    it("acepta modelo_cobro válido", () => {
      const result = ActualizarAlumnoSchema.safeParse({
        nombre: "Juan",
        apellido: "García",
        grado: "5to",
        modelo_cobro: "abono_mensual",
        tarifa_override: 5000,
      });
      expect(result.success).toBe(true);
    });

    it("rechaza modelo_cobro desconocido", () => {
      const result = ActualizarAlumnoSchema.safeParse({
        nombre: "Juan",
        apellido: "García",
        grado: "5to",
        modelo_cobro: "totalmente_inventado",
      });
      expect(result.success).toBe(false);
    });

    it("acepta tarifa_override null", () => {
      const result = ActualizarAlumnoSchema.safeParse({
        nombre: "Juan",
        apellido: "García",
        grado: "5to",
        modelo_cobro: "por_clase",
        tarifa_override: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("RegistrarPagoSchema", () => {
    it("acepta pago válido", () => {
      const result = RegistrarPagoSchema.safeParse({
        alumno_id: "550e8400-e29b-41d4-a716-446655440000",
        monto: 5000,
        estado: "pagado",
        fecha_pago: "2026-05-20",
      });
      expect(result.success).toBe(true);
    });

    it("rechaza UUID inválido", () => {
      const result = RegistrarPagoSchema.safeParse({
        alumno_id: "not-a-uuid",
        monto: 5000,
        estado: "pagado",
      });
      expect(result.success).toBe(false);
    });

    it("rechaza monto negativo", () => {
      const result = RegistrarPagoSchema.safeParse({
        alumno_id: "550e8400-e29b-41d4-a716-446655440000",
        monto: -100,
        estado: "pagado",
      });
      expect(result.success).toBe(false);
    });

    it("rechaza monto cero", () => {
      const result = RegistrarPagoSchema.safeParse({
        alumno_id: "550e8400-e29b-41d4-a716-446655440000",
        monto: 0,
        estado: "pagado",
      });
      expect(result.success).toBe(false);
    });

    it("rechaza monto excesivamente alto", () => {
      const result = RegistrarPagoSchema.safeParse({
        alumno_id: "550e8400-e29b-41d4-a716-446655440000",
        monto: 100_000_000,
        estado: "pagado",
      });
      expect(result.success).toBe(false);
    });

    it("rechaza estado inválido", () => {
      const result = RegistrarPagoSchema.safeParse({
        alumno_id: "550e8400-e29b-41d4-a716-446655440000",
        monto: 5000,
        estado: "no_existe",
      });
      expect(result.success).toBe(false);
    });

    it("rechaza fecha en formato inválido", () => {
      const result = RegistrarPagoSchema.safeParse({
        alumno_id: "550e8400-e29b-41d4-a716-446655440000",
        monto: 5000,
        estado: "pagado",
        fecha_pago: "20/05/2026",
      });
      expect(result.success).toBe(false);
    });

    it("rechaza período en formato inválido", () => {
      const result = RegistrarPagoSchema.safeParse({
        alumno_id: "550e8400-e29b-41d4-a716-446655440000",
        monto: 5000,
        estado: "pagado",
        periodo: "mayo-2026",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("RegistrarGastoSchema", () => {
    it("acepta gasto válido", () => {
      const result = RegistrarGastoSchema.safeParse({
        categoria: "material",
        monto: 1000,
        fecha: "2026-05-20",
      });
      expect(result.success).toBe(true);
    });

    it("aplica recurrente default false", () => {
      const result = RegistrarGastoSchema.safeParse({
        categoria: "viatico",
        monto: 500,
        fecha: "2026-05-20",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recurrente).toBe(false);
      }
    });

    it("rechaza categoría inválida", () => {
      const result = RegistrarGastoSchema.safeParse({
        categoria: "inexistente",
        monto: 1000,
        fecha: "2026-05-20",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("GuardarTarifaSchema", () => {
    it("acepta tarifa positiva", () => {
      const result = GuardarTarifaSchema.safeParse({ valor_hora: 5000 });
      expect(result.success).toBe(true);
    });

    it("rechaza tarifa cero o negativa", () => {
      expect(GuardarTarifaSchema.safeParse({ valor_hora: 0 }).success).toBe(false);
      expect(GuardarTarifaSchema.safeParse({ valor_hora: -100 }).success).toBe(false);
    });
  });

  describe("CargarCreditosSchema", () => {
    it("acepta pack de créditos válido", () => {
      const result = CargarCreditosSchema.safeParse({
        alumno_id: "550e8400-e29b-41d4-a716-446655440000",
        creditos: 8,
        monto: 40000,
      });
      expect(result.success).toBe(true);
    });

    it("rechaza créditos < 1", () => {
      const result = CargarCreditosSchema.safeParse({
        alumno_id: "550e8400-e29b-41d4-a716-446655440000",
        creditos: 0,
        monto: 5000,
      });
      expect(result.success).toBe(false);
    });

    it("rechaza créditos > 100", () => {
      const result = CargarCreditosSchema.safeParse({
        alumno_id: "550e8400-e29b-41d4-a716-446655440000",
        creditos: 200,
        monto: 5000,
      });
      expect(result.success).toBe(false);
    });
  });
});
