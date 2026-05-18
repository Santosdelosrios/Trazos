import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import type { ResumenFinancieroMes } from "@/lib/types/database";
import Link from "next/link";
import { Wallet, AlertCircle, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  resumen: ResumenFinancieroMes | null;
}

export default function ResumenFinanciero({ resumen }: Props) {
  const ingresos = resumen?.ingresos_mes ?? 0;
  const gastos = resumen?.gastos_mes ?? 0;
  const neto = resumen?.ganancia_neta ?? 0;
  const pendientes = resumen?.pagos_pendientes ?? 0;

  // Calculate percentages for progress bars
  const totalEsperado = ingresos + (pendientes > 0 ? pendientes * 1000 : 0); // rough estimation
  const cobradoPct = totalEsperado > 0 ? Math.min((ingresos / totalEsperado) * 100, 100) : 0;
  const gastosPct = ingresos > 0 ? Math.min((gastos / ingresos) * 100, 100) : 0;

  return (
    <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-surface-100 bg-gradient-to-r from-primary-50 to-accent-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-surface-900 flex items-center gap-2">
            <Wallet size={18} className="text-primary-600" /> Resumen del Mes
          </h2>
          <Link
            href="/finanzas"
            className="flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline transition-colors"
          >
            Ver detalle <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Ingresos vs Gastos - Visual Bar */}
        <div className="space-y-3">
          {/* Ingresos */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-surface-600 flex items-center gap-1.5">
                <TrendingUp size={13} className="text-success-500" />
                Ingresos
              </span>
              <span className="text-sm font-extrabold text-success-600">
                {formatearMonto(ingresos)}
              </span>
            </div>
            <div className="w-full bg-surface-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-success-400 to-success-500 h-2.5 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.max(cobradoPct, ingresos > 0 ? 8 : 0)}%` }}
              />
            </div>
          </div>

          {/* Gastos */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-surface-600 flex items-center gap-1.5">
                <TrendingDown size={13} className="text-danger-400" />
                Gastos
              </span>
              <span className="text-sm font-extrabold text-danger-500">
                {formatearMonto(gastos)}
              </span>
            </div>
            <div className="w-full bg-surface-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-danger-300 to-danger-400 h-2.5 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.max(gastosPct, gastos > 0 ? 8 : 0)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-surface-200" />

        {/* Bottom stats row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Ganancia Neta */}
          <div className="rounded-xl bg-surface-50 border border-surface-100 p-3 text-center">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1">
              Ganancia Neta
            </span>
            <span
              className={`text-lg font-extrabold ${
                neto >= 0 ? "text-primary-600" : "text-danger-500"
              }`}
            >
              {formatearMonto(neto)}
            </span>
          </div>

          {/* Pagos Pendientes */}
          <div className={`rounded-xl border p-3 text-center ${
            pendientes > 0 
              ? "bg-warning-50 border-warning-200" 
              : "bg-surface-50 border-surface-100"
          }`}>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1">
              Pendientes
            </span>
            <div className="flex items-center justify-center gap-1.5">
              <span
                className={`text-lg font-extrabold ${
                  pendientes > 0 ? "text-warning-500" : "text-surface-400"
                }`}
              >
                {pendientes}
              </span>
              {pendientes > 0 && (
                <AlertCircle size={14} className="text-warning-500 animate-pulse-soft" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
