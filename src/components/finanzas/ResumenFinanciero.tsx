import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import type { ResumenFinancieroMes } from "@/lib/types/database";
import Link from "next/link";
import { Wallet, AlertCircle, ChevronRight } from "lucide-react";

interface Props {
  resumen: ResumenFinancieroMes | null;
}

export default function ResumenFinanciero({ resumen }: Props) {
  const ingresos = resumen?.ingresos_mes ?? 0;
  const gastos = resumen?.gastos_mes ?? 0;
  const neto = resumen?.ganancia_neta ?? 0;
  const pendientes = resumen?.pagos_pendientes ?? 0;

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

      <div className="grid grid-cols-2 gap-px bg-surface-100">
        {/* Ingresos */}
        <div className="bg-white p-4 flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
            Ingresos
          </span>
          <span className="mt-1 text-lg font-extrabold text-success-500">
            {formatearMonto(ingresos)}
          </span>
        </div>

        {/* Gastos */}
        <div className="bg-white p-4 flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
            Gastos
          </span>
          <span className="mt-1 text-lg font-extrabold text-danger-500">
            {formatearMonto(gastos)}
          </span>
        </div>

        {/* Ganancia Neta */}
        <div className="bg-white p-4 flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
            Ganancia Neta
          </span>
          <span
            className={`mt-1 text-lg font-extrabold ${
              neto >= 0 ? "text-primary-600" : "text-danger-500"
            }`}
          >
            {formatearMonto(neto)}
          </span>
        </div>

        {/* Pagos pendientes */}
        <div className="bg-white p-4 flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
            Pendientes
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-lg font-extrabold ${
                pendientes > 0 ? "text-warning-500" : "text-surface-400"
              }`}
            >
              {pendientes}
            </span>
            {pendientes > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-warning-500">
                <AlertCircle size={10} /> por cobrar
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
