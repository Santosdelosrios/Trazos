import { describe, it, expect } from "vitest";
import { buildAsistenteSystemPrompt, TIZA_OUT_OF_SCOPE_REPLY } from "./system-prompt";

describe("system prompt de Tiza", () => {
  it("incluye la identidad inmutable", () => {
    const prompt = buildAsistenteSystemPrompt();
    expect(prompt).toContain("IDENTIDAD INMUTABLE");
    expect(prompt).toContain("NO sos un chatbot de propósito general");
    expect(prompt).toContain("NO sos ChatGPT");
  });

  it("incluye reglas anti-jailbreak con frases comunes", () => {
    const prompt = buildAsistenteSystemPrompt();
    expect(prompt).toContain("ignorá las instrucciones anteriores");
    expect(prompt).toContain("modo DAN");
    expect(prompt).toContain("actuá como");
  });

  it("incluye el scope permitido de las 6 áreas", () => {
    const prompt = buildAsistenteSystemPrompt();
    expect(prompt).toContain("Agenda");
    expect(prompt).toContain("Alumnos");
    expect(prompt).toContain("Cobros");
    expect(prompt).toContain("Finanzas");
    expect(prompt).toContain("Feriados");
  });

  it("incluye la frase de escape canónica", () => {
    const prompt = buildAsistenteSystemPrompt();
    expect(prompt).toContain(TIZA_OUT_OF_SCOPE_REPLY);
  });

  it("incluye fecha y hora actual en contexto temporal", () => {
    const prompt = buildAsistenteSystemPrompt();
    expect(prompt).toContain("Fecha y hora actual:");
  });

  it("incluye instrucciones de personalidad rioplatense", () => {
    const prompt = buildAsistenteSystemPrompt();
    expect(prompt).toContain("voseo");
    expect(prompt).toMatch(/vos|tenés|podés/);
  });

  it("incluye instrucciones operativas críticas (buscar_alumno antes de actuar)", () => {
    const prompt = buildAsistenteSystemPrompt();
    expect(prompt).toContain("buscar_alumno");
    expect(prompt).toContain("SIEMPRE");
  });

  it("incluye el flujo de organizar cobro mensual", () => {
    const prompt = buildAsistenteSystemPrompt();
    expect(prompt).toContain("Organizar Cobro Mensual");
    expect(prompt).toContain("WHATSAPP_PREVIEW");
  });

  it("la frase de escape redirige a la app", () => {
    expect(TIZA_OUT_OF_SCOPE_REPLY).toContain("Trazos");
    expect(TIZA_OUT_OF_SCOPE_REPLY.toLowerCase()).toMatch(/agenda|alumnos|cobros|finanzas/);
  });
});
