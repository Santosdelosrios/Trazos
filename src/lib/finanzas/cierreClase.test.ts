import { describe, it, expect, vi } from "vitest";
import { aplicarModeloCobroCierre, rangoMesISO } from "./cierreClase";
import type { ModeloCobro } from "@/lib/types/database";

// ============================================================
// Mock minimalista del SupabaseClient
//
// Simula el patrón fluido .from(...).select(...).eq(...).maybeSingle()
// que usa el helper, y también .insert(...).select().single() y
// .upsert(...). Cada test arma un schema que mapea tabla → respuesta
// (consultas) o tabla → bucket de inserciones / upserts.
// ============================================================

interface Schema {
  query?: Record<string, () => unknown>;
  inserts: Record<string, Array<Record<string, unknown>>>;
  upserts: Record<string, Array<Record<string, unknown>>>;
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
              single: async () => ({
                data: { id: `${table}-${schema.inserts[table].length}` },
                error: null,
              }),
            };
          },
        };
      },
      upsert(payload: Record<string, unknown>, _opts?: unknown) {
        if (!schema.upserts[table]) schema.upserts[table] = [];
        schema.upserts[table].push(payload);
        return Promise.resolve({ data: null, error: null });
      },
      eq() { return fluent; },
      gte() { return fluent; },
      lte() { return fluent; },
      is() { return fluent; },
      order() { return fluent; },
      maybeSingle: async () => {
        const fn = schema.query?.[table];
        return { data: fn ? fn() : null, error: null };
      },
      then(onFulfilled: (v: { count: number | null; data: null; error: null }) => unknown) {
        if (countMode) {
          const fn = schema.query?.[table + ":count"];
          const value = fn ? (fn() as number) : 0;
          return Promise.resolve({ count: value, data: null, error: null }).then(onFulfilled);
        }
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
  montoAbono?: number;
  tope?: number | null;
  clasesEnMes?: number;
  /** Si true, el guard de idempotencia encuentra un cargo previo
   *  y NO inserta uno nuevo. */
  cargoExistente?: boolean;
}): Schema {
  return {
    inserts: {},
    upserts: {},
    query: {
      alumnos: () => ({
        modelo_cobro: opts.modelo,
        monto_abono_mensual: opts.montoAbono ?? null,
        tope_clases_mes: opts.tope ?? null,
      }),
      maestras: () => ({ cobros_automaticos_clases: opts.flag }),
      cargos: () => (opts.cargoExistente ? { id: "cargo-existente" } : null),
      "clase_alumnos:count": () => opts.clasesEnMes ?? 0,
    },
  };
}

// ============================================================
// Tests
// ============================================================

describe("aplicarModeloCobroCierre — flag off", () => {
  it("no genera cargo para por_clase", async () => {
    const s = schema({ modelo: "por_clase", flag: false });
    const supa = makeSupabase(s);
    const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
    expect(res.flag_apagado).toBe(true);
    expect(s.inserts.cargos).toBeUndefined();
    expect(s.upserts.cargos).toBeUndefined();
  });

  it("bolsa_creditos: descuenta crédito vía cargo con monto=0", async () => {
    const s = schema({ modelo: "bolsa_creditos", flag: false });
    const supa = makeSupabase(s);
    const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
    expect(res.flag_apagado).toBe(true);
    expect(s.inserts.cargos).toHaveLength(1);
    expect(s.inserts.cargos[0]).toMatchObject({
      concepto: "clase",
      monto: 0,
      creditos_consumidos: 1,
      clase_id: "clase-1",
    });
  });

  it("abono_mensual con flag off: no genera nada", async () => {
    const s = schema({ modelo: "abono_mensual", flag: false, montoAbono: 30000 });
    const supa = makeSupabase(s);
    const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
    expect(res.flag_apagado).toBe(true);
    expect(s.inserts.cargos).toBeUndefined();
    expect(s.upserts.cargos).toBeUndefined();
  });
});

describe("aplicarModeloCobroCierre — flag on", () => {
  it("por_clase: genera cargo concepto='clase' con monto y sin créditos", async () => {
    const s = schema({ modelo: "por_clase", flag: true });
    const supa = makeSupabase(s);
    const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
    expect(res.flag_apagado).toBe(false);
    expect(res.excedente_abono).toBe(false);
    expect(res.cargo_id).toBeTruthy();
    expect(s.inserts.cargos).toHaveLength(1);
    expect(s.inserts.cargos[0]).toMatchObject({
      concepto: "clase",
      monto: 5000,
      creditos_consumidos: 0,
      clase_id: "clase-1",
    });
  });

  it("bolsa_creditos: genera cargo con monto y creditos_consumidos=1", async () => {
    const s = schema({ modelo: "bolsa_creditos", flag: true });
    const supa = makeSupabase(s);
    const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
    expect(res.flag_apagado).toBe(false);
    expect(s.inserts.cargos).toHaveLength(1);
    expect(s.inserts.cargos[0]).toMatchObject({
      concepto: "clase",
      monto: 5000,
      creditos_consumidos: 1,
    });
  });

  describe("abono_mensual", () => {
    it("lazy: hace upsert del cargo mensual con periodo correcto", async () => {
      const s = schema({ modelo: "abono_mensual", flag: true, montoAbono: 30000 });
      const supa = makeSupabase(s);
      const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
      expect(res.excedente_abono).toBe(false);
      expect(s.upserts.cargos).toHaveLength(1);
      expect(s.upserts.cargos[0]).toMatchObject({
        concepto: "abono_mensual",
        monto: 30000,
        periodo: "2026-05",
        fecha: "2026-05-01",
      });
      // No genera cargo de clase
      expect(s.inserts.cargos).toBeUndefined();
    });

    it("sin monto_abono: no genera upsert (alumno sin abono activo)", async () => {
      const s = schema({ modelo: "abono_mensual", flag: true, montoAbono: 0 });
      const supa = makeSupabase(s);
      const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
      expect(res.excedente_abono).toBe(false);
      expect(s.upserts.cargos).toBeUndefined();
      expect(s.inserts.cargos).toBeUndefined();
    });

    it("dentro del tope: hace upsert del abono pero no genera cargo de clase", async () => {
      const s = schema({
        modelo: "abono_mensual", flag: true, montoAbono: 30000,
        tope: 8, clasesEnMes: 5,
      });
      const supa = makeSupabase(s);
      const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
      expect(res.excedente_abono).toBe(false);
      expect(s.upserts.cargos).toHaveLength(1);
      expect(s.inserts.cargos).toBeUndefined();
    });

    it("supera el tope: upsert del abono + cargo de clase excedente", async () => {
      const s = schema({
        modelo: "abono_mensual", flag: true, montoAbono: 30000,
        tope: 8, clasesEnMes: 9,
      });
      const supa = makeSupabase(s);
      const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
      expect(res.excedente_abono).toBe(true);
      expect(res.cargo_id).toBeTruthy();
      // Upsert del abono mensual
      expect(s.upserts.cargos).toHaveLength(1);
      expect(s.upserts.cargos[0]).toMatchObject({ concepto: "abono_mensual" });
      // Insert del excedente
      expect(s.inserts.cargos).toHaveLength(1);
      expect(s.inserts.cargos[0]).toMatchObject({
        concepto: "clase",
        monto: 5000,
        descripcion: "Clase excedente al tope del abono mensual",
      });
    });
  });
});

describe("idempotencia por (clase_id, alumno_id)", () => {
  it("por_clase con cargo previo: NO duplica, retorna el existente", async () => {
    const s = schema({ modelo: "por_clase", flag: true, cargoExistente: true });
    const supa = makeSupabase(s);
    const res = await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
    expect(res.cargo_id).toBe("cargo-existente");
    expect(s.inserts.cargos).toBeUndefined();  // no insert
  });

  it("bolsa_creditos con cargo previo: NO duplica el descuento", async () => {
    const s = schema({ modelo: "bolsa_creditos", flag: true, cargoExistente: true });
    const supa = makeSupabase(s);
    await aplicarModeloCobroCierre(supa, "maestra-1", baseInput());
    expect(s.inserts.cargos).toBeUndefined();
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

vi.spyOn(console, "warn").mockImplementation(() => {});
