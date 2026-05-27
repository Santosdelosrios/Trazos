import Link from "next/link";
import { PieChart, ChevronRight } from "lucide-react";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import { agruparGastosTopN } from "@/lib/finanzas/agruparGastos";
import type { GastoPorCategoriaMes } from "@/lib/types/database";

interface Props {
  items: GastoPorCategoriaMes[];
  total: number;
  /** Cuántas mostrar antes de agrupar el resto como "Otros". */
  topN?: number;
}

/**
 * Desglose de gastos del mes por categoría como barras horizontales
 * puro CSS (sin librería). Las primeras `topN` por monto se muestran
 * detalladas; el resto se agrupa en "Otros".
 */
export default function GastosPorCategoriaCard({
  items, total, topN = 5,
}: Props) {
  if (items.length === 0 || total <= 0) {
    return (
      <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
            <PieChart size={16} className="text-primary-600" /> Gastos por categoría
          </h3>
          <Link href="/finanzas/gastos" className="flex items-center gap-1 text-xs font-bold text-primary-600 hover:underline">
            Ver todos <ChevronRight size={14} />
          </Link>
        </div>
        <p className="text-xs text-surface-400">
          Sin gastos registrados este mes.
        </p>
      </div>
    );
  }

  const filas = agruparGastosTopN(items, topN);

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
          <PieChart size={16} className="text-primary-600" /> Gastos por categoría
        </h3>
        <Link href="/finanzas/gastos" className="flex items-center gap-1 text-xs font-bold text-primary-600 hover:underline">
          Ver todos <ChevronRight size={14} />
        </Link>
      </div>

      <div className="space-y-3">
        {filas.map((f, idx) => {
          const pct = total > 0 ? (f.total / total) * 100 : 0;
          return (
            <div key={idx}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-surface-700 truncate min-w-0">
                  {f.nombre}
                </span>
                <div className="flex items-baseline gap-1.5 shrink-0">
                  <span className="text-[10px] text-surface-400">
                    {pct.toFixed(0)}%
                  </span>
                  <span className="font-bold text-danger-500">
                    {formatearMonto(f.total)}
                  </span>
                </div>
              </div>
              <div className="w-full bg-surface-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-danger-300 to-danger-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
