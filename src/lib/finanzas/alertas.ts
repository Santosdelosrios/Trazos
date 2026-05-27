// ============================================================
// alertas.ts — Helpers de presentación para las alertas inteligentes
//
// La RPC alertas_finanzas devuelve {tipo, severidad, payload}. Acá
// mapeamos cada tipo a su label + descripción + CTA + ícono para
// que el componente Alertas sea declarativo.
// ============================================================

import type { AlertaFinanza, AlertaFinanzaSeveridad } from "@/lib/types/database";
import { formatearMonto } from "./formatearMonto";

export interface AlertaPresentacion {
  titulo: string;
  descripcion: string;
  cta: { label: string; href: string } | null;
  /** Tono visual derivado de severidad. */
  tono: {
    bg: string;
    border: string;
    iconBg: string;
    iconColor: string;
    titleColor: string;
  };
  /** Nombre de un ícono lucide-react. El componente hace el mapeo. */
  icono: string;
}

const TONOS: Record<AlertaFinanzaSeveridad, AlertaPresentacion["tono"]> = {
  info: {
    bg: "bg-primary-50",
    border: "border-primary-200",
    iconBg: "bg-primary-100",
    iconColor: "text-primary-600",
    titleColor: "text-primary-900",
  },
  warning: {
    bg: "bg-warning-50",
    border: "border-warning-200",
    iconBg: "bg-warning-100",
    iconColor: "text-warning-600",
    titleColor: "text-warning-900",
  },
  critical: {
    bg: "bg-danger-50",
    border: "border-danger-200",
    iconBg: "bg-danger-100",
    iconColor: "text-danger-600",
    titleColor: "text-danger-900",
  },
};

export function presentarAlerta(a: AlertaFinanza): AlertaPresentacion {
  const tono = TONOS[a.severidad] ?? TONOS.info;

  switch (a.tipo) {
    case "alumno_deuda_15d": {
      const nombre = String(a.payload.nombre ?? "Alumno");
      const saldo = Number(a.payload.saldo ?? 0);
      const dias = Number(a.payload.dias_desde_ultima_clase ?? 0);
      const alumnoId = a.payload.alumno_id as string | undefined;
      return {
        titulo: `${nombre} te debe ${formatearMonto(saldo)}`,
        descripcion: dias > 0
          ? `Última clase hace ${dias} días.`
          : "Hay clases pendientes de cobrar.",
        cta: alumnoId
          ? { label: "Ir a la cuenta", href: `/alumnos/${alumnoId}` }
          : { label: "Ver cuentas", href: "/finanzas/cuentas" },
        tono, icono: "user",
      };
    }

    case "cobro_pendiente_30d": {
      const alumno = String(a.payload.alumno ?? "Alumno");
      const monto = Number(a.payload.monto ?? 0);
      const dias = Number(a.payload.dias ?? 0);
      return {
        titulo: `Cobro pendiente hace ${dias} días`,
        descripcion: `${alumno} · ${formatearMonto(monto)}.`,
        cta: { label: "Ir a Cobranzas", href: "/finanzas/cobranzas" },
        tono, icono: "clock",
      };
    }

    case "tarifa_desactualizada": {
      const meses = Number(a.payload.meses ?? 0);
      const valor = Number(a.payload.valor_hora ?? 0);
      return {
        titulo: "Tu tarifa lleva tiempo sin cambios",
        descripcion: `Hace ${meses} meses que está en ${formatearMonto(valor)}/hora. ¿Querés ajustarla?`,
        cta: { label: "Revisar tarifa", href: "/finanzas/tarifas" },
        tono, icono: "calculator",
      };
    }

    case "caida_facturacion_20pct": {
      const actual = Number(a.payload.actual ?? 0);
      const anterior = Number(a.payload.anterior ?? 0);
      const pct = Number(a.payload.caida_pct ?? 0);
      return {
        titulo: `Facturación ${pct}% abajo del mes pasado`,
        descripcion: `Mes actual: ${formatearMonto(actual)} · Anterior: ${formatearMonto(anterior)}.`,
        cta: { label: "Ver histórico", href: "/finanzas/historico" },
        tono, icono: "trending-down",
      };
    }

    default:
      return {
        titulo: "Alerta",
        descripcion: "",
        cta: null,
        tono, icono: "info",
      };
  }
}

/**
 * Helper para comparativa simple usada en la card del histórico.
 * Devuelve la variación porcentual entre dos valores. Si el anterior
 * es 0 y el actual > 0, devuelve null (no se puede calcular).
 */
export function variacionPorcentual(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual === 0 ? 0 : null;
  return Math.round(((actual - anterior) / anterior) * 100);
}
