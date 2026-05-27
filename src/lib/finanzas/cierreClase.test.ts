import { describe, it, expect, vi } from "vitest";
import { aplicarModeloCobroCierre, rangoMesISO } from "./cierreClase";
import type { ModeloCobro } from "@/lib/types/database";

// ============================================================
// Mock minimalista del SupabaseClient
//
// Simula el patrón fluido .from(...).select(...).eq(...).maybeSingle()
// que usa el helper. Cada test arma un "schema" que mapea tabla →
// respuesta deseada (consultas) o tabla → bucket de inserciones.
// ============================================================

interface Schema {
  // Para queries (select / count)
  query?: Record<string, () => unknown>;
  // Para inserts: recolecta lo insertado por tabla
  inserts: Record<string, Array<Record<string, unknown>>>;
}

function makeSupabase(schema: Schema) {
  function from(table: string) {
    let countMode = false;
    const fluent = {
      select(_cols: string, opts?: { count?: string; head?: boolean }) {
        if (opts?.count === "exact") countMode = true;
        return fluent;
      },
      insert(payload: Record<string, unknown>) {
        if (!schema.inserts[table]) schema.inserts[table] = [];
        schema.inserts[table].push(payload);
        return {
          select() {
            return {
              single: async () => ({ data: { id: "pago-" + schema.inserts[table].length }, error: null }),
            };
          },
        };
      },
      eq() { return fluent; },
      gte() { return fluent; },
      lte() { return fluent; },
      maybeSingle: async () => {
        const fn = schema.query?.[table];
        return { data: fn ? fn() : null, error: null };
      },
      // count queries terminan en awaited Promise sin .single
      then(onFulfilled: (v: { count: number | null; data: null; error: null }) => unknown) {
        if (countMode) {
          const fn = schema.query?.[table + ":count"];
          const value = fn ? (fn() as number) : 0;
          return Promise.resolve({ count: value, data: null, error: null }).then(onFulfilled);
        }
        // Fallback: select all → empty
        return Promise.resolve({ count: null, data: null, error: null }).then(onFulfilled);
      },
    };
    return fluent;
  }
  return { from } as unknown as Parameters<typeof aplicarModeloCobroCierre>[0];
}

function baseInput() {
  return {
    clase_id: "clase-1",
    alumno_id: "alumno-1",
    monto: 5000,
    fecha_clase: "2026-05-15",
    descripcion: "Clase de prueba",
  };
}

function schema(opts: {
  modelo: ModeloCobro;
  flag: boolean;
  tope?: number | null;
  clasesEnMes?: number;
}): Schema {
  return {
    inserts: {},
    query: {
      alumnos: () => ({ modelo_cobro: opts.modelo }),
      maestras: () => ({ cobros_automaticos_clases: opts.flag }),
      abonos: () => (opts.tope == null ? null : { tope_clases_mes: opts.tope }),
      "clase_alumnos:count": () => opts.clasesEnMes ?? 0,
    },
  };
}

// ============================================================
// Tests
// ============================================================

describe("aplicarModeloCobroCierre — flag off", () => {
  it("no genera cobro ni movimiento para por_clase", async () => {
    const s = schema({ modelo: "por_clase", flag: false });
    const supa = makeSupabase(s);
    const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
    expect(res.flag_apagado).toBe(true);
    expect(s.inserts.pagos).toBeUndefined();
    expect(s.inserts.movimientos_cuenta).toBeUndefined();
  });

  it("aún así descuenta crédito en bolsa_creditos (si no, la bolsa nunca termina)", async () => {
    const s = schema({ modelo: "bolsa_creditos", flag: false });
    const supa = makeSupabase(s);
    const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
    expect(res.flag_apagado).toBe(true);
    expect(s.inserts.movimientos_cuenta).toHaveLength(1);
    expect(s.inserts.movimientos_cuenta[0]).toMatchObject({
      tipo_movimiento: "clase_descontada",
      creditos: -1,
      monto: 0,
    });
  });
});

describe("aplicarModeloCobroCierre — flag on", () => {
  it("por_clase: genera pago pendiente con origen auto_clase", async () => {
    const s = schema({ modelo: "por_clase", flag: true });
    const supa = makeSupabase(s);
    const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
    expect(res.flag_apagado).toBe(false);
    expect(res.excedente_abono).toBe(false);
    expect(res.pago_id).toBeTruthy();
    expect(s.inserts.pagos).toHaveLength(1);
    expect(s.inserts.pagos[0]).toMatchObject({
      estado: "pendiente",
      origen: "auto_clase",
      monto: 5000,
      clase_id: "clase-1",
    });
  });

  it("cuenta_corriente: registra movimiento con monto negativo, sin pagos", async () => {
    const s = schema({ modelo: "cuenta_corriente", flag: true });
    const supa = makeSupabase(s);
    await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
    expect(s.inserts.pagos).toBeUndefined();
    expect(s.inserts.movimientos_cuenta).toHaveLength(1);
    expect(s.inserts.movimientos_cuenta[0]).toMatchObject({
      monto: -5000,
      creditos: 0,
      tipo_movimiento: "clase_descontada",
    });
  });

  it("bolsa_creditos: descuenta 1 crédito vía movimiento", async () => {
    const s = schema({ modelo: "bolsa_creditos", flag: true });
    const supa = makeSupabase(s);
    await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
    expect(s.inserts.movimientos_cuenta[0].creditos).toBe(-1);
  });

  describe("abono_mensual", () => {
    it("sin tope: no genera nada", async () => {
      const s = schema({ modelo: "abono_mensual", flag: true, tope: null });
      const supa = makeSupabase(s);
      const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
      expect(res.excedente_abono).toBe(false);
      expect(s.inserts.pagos).toBeUndefined();
    });

    it("dentro del tope: no genera cobro", async () => {
      const s = schema({ modelo: "abono_mensual", flag: true, tope: 8, clasesEnMes: 5 });
      const supa = makeSupabase(s);
      const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
      expect(res.excedente_abono).toBe(false);
      expect(s.inserts.pagos).toBeUndefined();
    });

    it("supera el tope: genera cobro suelto con origen abono_excedente", async () => {
      const s = schema({ modelo: "abono_mensual", flag: true, tope: 8, clasesEnMes: 9 });
      const supa = makeSupabase(s);
      const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
      expect(res.excedente_abono).toBe(true);
      expect(s.inserts.pagos).toHaveLength(1);
      expect(s.inserts.pagos[0]).toMatchObject({
        origen: "abono_excedente",
        estado: "pendiente",
        monto: 5000,
      });
    });
  });
});

describe("rangoMesISO", () => {
  it("calcula primer y último día del mes (mes con 30 días)", () => {
    expect(rangoMesISO("2026-04-15")).toEqual({ inicio: "2026-04-01", fin: "2026-04-30" });
  });

  it("calcula último día correcto para febrero año común", () => {
    expect(rangoMesISO("2026-02-10")).toEqual({ inicio: "2026-02-01", fin: "2026-02-28" });
  });

  it("calcula último día correcto para febrero año bisiesto", () => {
    expect(rangoMesISO("2024-02-10")).toEqual({ inicio: "2024-02-01", fin: "2024-02-29" });
  });

  it("mes de 31 días", () => {
    expect(rangoMesISO("2026-12-31")).toEqual({ inicio: "2026-12-01", fin: "2026-12-31" });
  });
});

// Silenciar console.warn de los mocks si llegara a haber
vi.spyOn(console, "warn").mockImplementation(() => {});
