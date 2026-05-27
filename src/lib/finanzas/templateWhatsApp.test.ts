import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  buildVars,
  TEMPLATE_DEFAULT,
  TEMPLATE_DEFAULT_FAMILIA,
  VARIABLES_TEMPLATE,
} from "./templateWhatsApp";

describe("renderTemplate", () => {
  it("reemplaza variables presentes", () => {
    const r = renderTemplate("Hola {nombre_alumno}, debés {monto}.", {
      nombre_alumno: "Sofía",
      monto: "$ 5.000",
    });
    expect(r).toBe("Hola Sofía, debés $ 5.000.");
  });

  it("reemplaza variables conocidas pero sin valor por string vacío", () => {
    const r = renderTemplate("Hola{nombre_responsable}!", {});
    expect(r).toBe("Hola!");
  });

  it("conserva placeholders desconocidos para que la maestra vea el typo", () => {
    const r = renderTemplate("Hola {nombre_alumno} y {variable_inexistente}.", {
      nombre_alumno: "Sofía",
    });
    expect(r).toBe("Hola Sofía y {variable_inexistente}.");
  });

  it("acepta valores numéricos", () => {
    const r = renderTemplate("Total clases: {cantidad_clases}", {
      cantidad_clases: 7,
    });
    expect(r).toBe("Total clases: 7");
  });

  it("reemplaza múltiples ocurrencias de la misma variable", () => {
    const r = renderTemplate("{nombre_alumno}, hola {nombre_alumno}", {
      nombre_alumno: "Sofía",
    });
    expect(r).toBe("Sofía, hola Sofía");
  });

  it("trata null como ausente (string vacío)", () => {
    const r = renderTemplate("Pago: {datos_pago}", {});
    expect(r).toBe("Pago: ");
  });
});

describe("buildVars", () => {
  it("prefija un espacio en nombre_responsable cuando hay valor", () => {
    const vars = buildVars({
      nombre_alumno: "Sofía",
      nombre_responsable: "Mariana",
      monto: 1000,
    });
    expect(vars.nombre_responsable).toBe(" Mariana");
  });

  it("deja nombre_responsable vacío cuando no hay nombre ni alumno fallback", () => {
    const vars = buildVars({ monto: 1000 });
    expect(vars.nombre_responsable).toBe("");
  });

  it("usa nombre_alumno como fallback del responsable (con espacio prefijado)", () => {
    const vars = buildVars({
      nombre_alumno: "Sofía Pérez",
      monto: 1000,
    });
    expect(vars.nombre_responsable).toBe(" Sofía Pérez");
  });

  it("formatea el mes en español", () => {
    const vars = buildVars({
      monto: 100,
      fecha_referencia: new Date(2026, 4, 15), // mayo (mes 4 = 5to)
    });
    expect(vars.mes).toBe("mayo");
  });

  it("arma detalle_clases con bullets y fechas en español corto", () => {
    const vars = buildVars({
      monto: 200,
      clases: [
        { fecha: "2026-05-08", tema: "Matemática", monto: 100 },
        { fecha: "2026-05-15", tema: "Lengua", monto: 100 },
      ],
    });
    expect(vars.detalle_clases).toContain("Matemática");
    expect(vars.detalle_clases).toContain("Lengua");
    expect(vars.cantidad_clases).toBe(2);
  });

  it("arma detalle_por_alumno omitiendo miembros con subtotal 0", () => {
    const vars = buildVars({
      monto: 5000,
      miembros_familia: [
        { nombre_completo: "Sofía", subtotal: 3000, clases: 2 },
        { nombre_completo: "Tomás", subtotal: 0, clases: 0 },
        { nombre_completo: "Lucas", subtotal: 2000, clases: 1 },
      ],
    });
    const det = vars.detalle_por_alumno as string;
    expect(det).toContain("Sofía");
    expect(det).toContain("Lucas");
    expect(det).not.toContain("Tomás");
    // singular vs plural
    expect(det).toContain("2 clases");
    expect(det).toContain("1 clase");
  });

  it("formatea monto con separadores de miles", () => {
    const vars = buildVars({ monto: 12500 });
    expect(vars.monto).toMatch(/12\.500/);
  });
});

describe("integración default templates", () => {
  it("renderiza el default sin dejar placeholders crudos cuando hay datos completos", () => {
    const vars = buildVars({
      nombre_alumno: "Sofía",
      nombre_responsable: "Mariana",
      monto: 5000,
      datos_pago: "Alias: maria",
      clases: [{ fecha: "2026-05-08", tema: "Mate", monto: 5000 }],
    });
    const out = renderTemplate(TEMPLATE_DEFAULT, vars);
    expect(out).not.toMatch(/\{[a-z_]+\}/i);
    expect(out).toContain("Sofía");
    expect(out).toContain("Mariana");
  });

  it("el default familiar incluye el desglose por alumno", () => {
    const vars = buildVars({
      nombre_alumno: "Familia Pérez",
      nombre_responsable: "Mariana",
      monto: 5000,
      datos_pago: "Alias: maria",
      miembros_familia: [
        { nombre_completo: "Sofía", subtotal: 3000, clases: 2 },
        { nombre_completo: "Tomás", subtotal: 2000, clases: 1 },
      ],
    });
    const out = renderTemplate(TEMPLATE_DEFAULT_FAMILIA, vars);
    expect(out).toContain("Sofía");
    expect(out).toContain("Tomás");
    expect(out).not.toMatch(/\{[a-z_]+\}/i);
  });

  it("la lista de variables exportadas se mantiene en 8 (contract test)", () => {
    expect(VARIABLES_TEMPLATE.length).toBe(8);
  });
});
