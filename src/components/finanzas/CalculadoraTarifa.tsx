"use client";

import { useState, useMemo, useTransition } from "react";
import { guardarTarifa } from "@/app/(dashboard)/finanzas/actions";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import { Calculator, Banknote, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface Props {
  tarifaActual?: number | null;
}

export default function CalculadoraTarifa({ tarifaActual }: Props) {
  const [isPending, startTransition] = useTransition();
  const [clasesSemanales, setClasesSemanales] = useState(10);
  const [gastosMensuales, setGastosMensuales] = useState(15000);
  const [gananciaDeseada, setGananciaDeseada] = useState(150000);
  const [valorHora, setValorHora] = useState(tarifaActual ?? 0);
  const [guardado, setGuardado] = useState(false);
  const toast = useToast();

  const clasesMensuales = useMemo(() => clasesSemanales * 4, [clasesSemanales]);
  const valorSugerido = useMemo(
    () =>
      clasesMensuales > 0
        ? Math.ceil((gananciaDeseada + gastosMensuales) / clasesMensuales / 100) * 100
        : 0,
    [clasesMensuales, gastosMensuales, gananciaDeseada]
  );

  function handleGuardar() {
    if (valorHora <= 0) return;
    setGuardado(false);
    startTransition(async () => {
      try {
        await guardarTarifa({ valor_hora: valorHora });
        setGuardado(true);
        toast.success(`Tarifa actualizada: ${formatearMonto(valorHora)}/hora`);
        setTimeout(() => setGuardado(false), 3000);
      } catch (err) {
        console.error("Error al guardar tarifa:", err);
        const msg = err instanceof Error ? err.message : "No se pudo guardar la tarifa";
        toast.error(msg);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Calculadora */}
      <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-surface-900 mb-4 flex items-center gap-2">
          <Calculator size={18} className="text-primary-600" /> Calculadora de Valor Hora
        </h3>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
              Clases por semana
            </label>
            <input
              type="number"
              min={1}
              max={40}
              value={clasesSemanales}
              onChange={(e) => setClasesSemanales(Number(e.target.value))}
              className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm font-semibold text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
              Gastos mensuales ($)
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              value={gastosMensuales}
              onChange={(e) => setGastosMensuales(Number(e.target.value))}
              className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm font-semibold text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
              Ganancia deseada ($)
            </label>
            <input
              type="number"
              min={0}
              step={5000}
              value={gananciaDeseada}
              onChange={(e) => setGananciaDeseada(Number(e.target.value))}
              className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm font-semibold text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
            />
          </div>
        </div>

        {/* Resultado sugerido */}
        <div className="mt-6 rounded-xl bg-gradient-to-r from-primary-50 to-accent-50 border border-primary-100/50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
                Valor sugerido por hora
              </p>
              <p className="mt-1 text-3xl font-black text-primary-700">
                {formatearMonto(valorSugerido)}
              </p>
              <p className="mt-1 text-xs text-surface-500">
                Basado en {clasesMensuales} clases/mes
              </p>
            </div>
            <button
              onClick={() => setValorHora(valorSugerido)}
              className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-700 transition-all active:scale-95"
            >
              Usar este valor
            </button>
          </div>
        </div>
      </div>

      {/* Guardar tarifa */}
      <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-surface-900 mb-4 flex items-center gap-2">
          <Banknote size={18} className="text-primary-600" /> Tu Tarifa Actual
        </h3>

        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
              Valor por hora ($)
            </label>
            <input
              type="number"
              min={0}
              step={100}
              value={valorHora}
              onChange={(e) => setValorHora(Number(e.target.value))}
              className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-lg font-bold text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
            />
          </div>

          <button
            onClick={handleGuardar}
            disabled={isPending || valorHora <= 0}
            className="rounded-xl bg-surface-900 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-primary-600 transition-all active:scale-95 disabled:opacity-50"
          >
            {isPending ? "Guardando..." : "Guardar Tarifa"}
          </button>
        </div>

        {guardado && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-success-500 animate-fade-in-up">
            <CheckCircle2 size={14} /> Tarifa guardada correctamente
          </p>
        )}

        {tarifaActual && tarifaActual > 0 && (
          <p className="mt-3 text-xs text-surface-400">
            Tarifa vigente: <strong className="text-surface-700">{formatearMonto(tarifaActual)}</strong>/hora
          </p>
        )}
      </div>
    </div>
  );
}
