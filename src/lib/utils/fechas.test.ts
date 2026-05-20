import { describe, it, expect } from "vitest";
import {
  getMonday,
  getWeekDays,
  isSameDay,
  formatDateKey,
  parseDateKey,
  formatFechaDiaMes,
  formatFechaCorta,
  formatFechaLarga,
} from "./fechas";

describe("fechas utils", () => {
  describe("getMonday", () => {
    it("returns the same day when input is monday", () => {
      const monday = new Date(2026, 4, 18); // 2026-05-18 — un lunes
      const result = getMonday(monday);
      expect(result.getDay()).toBe(1);
      expect(result.getDate()).toBe(18);
    });

    it("returns the previous monday when input is sunday", () => {
      const sunday = new Date(2026, 4, 24); // 2026-05-24 — un domingo
      const result = getMonday(sunday);
      expect(result.getDay()).toBe(1);
      expect(result.getDate()).toBe(18);
    });

    it("returns the previous monday when input is wednesday", () => {
      const wed = new Date(2026, 4, 20); // 2026-05-20 — un miércoles
      const result = getMonday(wed);
      expect(result.getDay()).toBe(1);
      expect(result.getDate()).toBe(18);
    });

    it("does not mutate the input date", () => {
      const original = new Date(2026, 4, 22);
      const originalDay = original.getDate();
      getMonday(original);
      expect(original.getDate()).toBe(originalDay);
    });

    it("normalizes to midnight (no time component)", () => {
      const wed = new Date(2026, 4, 20, 15, 30, 45);
      const result = getMonday(wed);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });
  });

  describe("getWeekDays", () => {
    it("returns 7 consecutive days starting from monday", () => {
      const monday = new Date(2026, 4, 18);
      const days = getWeekDays(monday);
      expect(days).toHaveLength(7);
      expect(days[0].getDate()).toBe(18);
      expect(days[6].getDate()).toBe(24);
    });
  });

  describe("isSameDay", () => {
    it("returns true for same Y/M/D regardless of time", () => {
      const a = new Date(2026, 4, 20, 9, 30);
      const b = new Date(2026, 4, 20, 23, 59);
      expect(isSameDay(a, b)).toBe(true);
    });

    it("returns false for different days", () => {
      const a = new Date(2026, 4, 20);
      const b = new Date(2026, 4, 21);
      expect(isSameDay(a, b)).toBe(false);
    });
  });

  describe("formatDateKey", () => {
    it("formats date as YYYY-MM-DD", () => {
      const d = new Date(2026, 4, 5); // mayo es mes 4 (0-indexed)
      expect(formatDateKey(d)).toBe("2026-05-05");
    });

    it("zero-pads single-digit months and days", () => {
      const d = new Date(2026, 0, 1); // 2026-01-01
      expect(formatDateKey(d)).toBe("2026-01-01");
    });
  });

  describe("parseDateKey", () => {
    it("parses YYYY-MM-DD as local date", () => {
      const d = parseDateKey("2026-05-20");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(4);
      expect(d.getDate()).toBe(20);
    });

    it("round-trips with formatDateKey", () => {
      const d = new Date(2026, 7, 15);
      const str = formatDateKey(d);
      const parsed = parseDateKey(str);
      expect(isSameDay(d, parsed)).toBe(true);
    });
  });

  describe("formatFechaDiaMes", () => {
    it("returns em-dash for null/undefined", () => {
      expect(formatFechaDiaMes(null)).toBe("—");
      expect(formatFechaDiaMes(undefined)).toBe("—");
    });

    it("returns em-dash for invalid string", () => {
      expect(formatFechaDiaMes("not-a-date")).toBe("—");
    });

    it("formats valid YYYY-MM-DD as día mes corto", () => {
      const result = formatFechaDiaMes("2026-05-20");
      // resultado depende del locale, pero debe incluir "20" y un mes corto
      expect(result).toMatch(/20/);
    });
  });

  describe("formatFechaCorta", () => {
    it("returns em-dash for empty input", () => {
      expect(formatFechaCorta(null)).toBe("—");
      expect(formatFechaCorta("")).toBe("—");
    });

    it("formats Date as DD/MM/YYYY", () => {
      const d = new Date(2026, 4, 20);
      const result = formatFechaCorta(d);
      expect(result).toContain("2026");
      expect(result).toContain("20");
    });
  });

  describe("formatFechaLarga", () => {
    it("returns em-dash for empty input", () => {
      expect(formatFechaLarga(null)).toBe("—");
    });

    it("formats Date as día mes-largo año", () => {
      const d = new Date(2026, 4, 20);
      const result = formatFechaLarga(d);
      expect(result).toContain("2026");
      expect(result.length).toBeGreaterThan(10);
    });
  });
});
