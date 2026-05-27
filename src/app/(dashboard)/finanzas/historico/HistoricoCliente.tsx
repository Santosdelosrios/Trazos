"use client";

import dynamic from "next/dynamic";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import { variacionPorcentual } from "@/lib/finanzas/alertas";
import type { HistoricoMes } from "@/lib/types/database";

// Dynamic import del gráfico → no entra al bundle del dashboard.
// ssr:false porque Recharts depende de mediciones del DOM.
const GraficoHistorico = dynamic(() => import("./GraficoHistorico"), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] flex items-center justify-center text-xs text-surface-400">
      Cargando gráfico…
    </div>
  ),
});

interface Props {
  data: HistoricoMes[];
}

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function etiquetaMes(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  return `${MESES_CORTOS[m - 1]} '${String(y).slice(2)}`;
}

export default function HistoricoCliente({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-200 bg-white p-12 text-center shadow-sm">
        <p className="text-sm text-surface-500">
          Todavía no hay datos suficientes para armar el histórico.
        </p>
      </div>
    );
  }

  // Comparativa mes actual vs anterior
  const actual = data[data.length - 1];
  const anterior = data.length >= 2 ? data[data.length - 2] : null;
  const variacionIngresos = anterior ? variacionPorcentual(actual.ingresos, anterior.ingresos) : null;
  const variacionNeto = anterior ? variacionPorcentual(actual.neto, anterior.neto) : null;

  const chartData = data.map((m) => ({
    mes: etiquetaMes(m.mes),
    ingresos: m.ingresos,
    gastos: m.gastos,
    neto: m.neto,
  }));

  return (
    <div className="space-y-6">
      {/* Card comparativa */}
      {anterior && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CardComparativa
            label="Ingresos vs mes anterior"
            actual={actual.ingresos}
            variacion={variacionIngresos}
          />
          <CardComparativa
            label="Ganancia neta vs mes anterior"
            actual={actual.neto}
            variacion={variacionNeto}
          />
        </div>
      )}

      {/* Gráfico */}
      <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-surface-900 mb-3">
          Últimos 12 meses
        </h3>
        <GraficoHistorico data={chartData} />
      </div>

      {/* Tabla resumen (mobile-friendly) */}
      <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-100 bg-surface-50/50">
          <h3 className="text-sm font-bold text-surface-900">Detalle por mes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 bg-surface-50/30">
                <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-surface-400">Mes</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-surface-400">Ingresos</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-surface-400">Gastos</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-surface-400">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {data.slice().reverse().map((m) => (
                <tr key={m.mes} className="hover:bg-surface-50/50">
                  <td className="px-4 py-2 font-semibold text-surface-900">
                    {etiquetaMes(m.mes)}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-success-600">
                    {formatearMonto(m.ingresos)}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-danger-500">
                    -{formatearMonto(m.gastos)}
                  </td>
                  <td className={`px-4 py-2 text-right font-extrabold ${m.neto >= 0 ? "text-primary-700" : "text-danger-600"}`}>
                    {formatearMonto(m.neto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CardComparativa({
  label, actual, variacion,
}: { label: string; actual: number; variacion: number | null }) {
  const positivo = (variacion ?? 0) > 0;
  const negativo = (variacion ?? 0) < 0;
  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-surface-900">
        {formatearMonto(actual)}
      </p>
      <div className="mt-2 flex items-center gap-1 text-xs">
        {variacion === null ? (
          <span className="text-surface-400 italic">Sin dato comparable</span>
        ) : (
          <>
            <span className={`flex items-center gap-1 font-bold ${
              positivo ? "text-success-600" : negativo ? "text-danger-500" : "text-surface-500"
            }`}>
              {positivo ? <TrendingUp size={12} /> : negativo ? <TrendingDown size={12} /> : <Minus size={12} />}
              {variacion > 0 ? "+" : ""}{variacion}%
            </span>
            <span className="text-surface-500">respecto al mes anterior</span>
          </>
        )}
      </div>
    </div>
  );
}
