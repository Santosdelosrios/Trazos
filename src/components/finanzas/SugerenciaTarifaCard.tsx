"use client";

import { useState, useTransition } from "react";
import { TrendingUp, Crown, Check, Sparkles, AlertCircle } from "lucide-react";
import { calcularSugerencia } from "@/lib/finanzas/inflacion";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import { aplicarTarifaSugerida } from "@/app/(dashboard)/finanzas/actions";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  tarifaActual: number | null;
  inflacionAcumulada: number; // fracción decimal
  meses: number;
  ultimoMesDatos: string | null; // YYYY-MM-DD del último mes con dato cargado
  esPremium: boolean;
}

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatMesLargo(yyyymmdd: string | null): string {
  if (!yyyymmdd) return "—";
  const [, mm, yy] = yyyymmdd.match(/(\d{4})-(\d{2})-(\d{2})/) ?? [];
  if (!mm || !yy) return yyyymmdd;
  return `${MESES_LARGOS[Number(mm) - 1]} ${yy}`;
}

export default function SugerenciaTarifaCard({
  tarifaActual, inflacionAcumulada, meses, ultimoMesDatos, esPremium,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [aplicada, setAplicada] = useState(false);
  const toast = useToast();
  const router = useRouter();

  if (tarifaActual == null || tarifaActual <= 0) {
    return (
      <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-surface-500">
          Definí tu tarifa global para ver la sugerencia de aumento por inflación.
        </p>
      </div>
    );
  }

  if (inflacionAcumulada <= 0 || meses === 0) {
    return (
      <div className="rounded-2xl border border-success-200 bg-success-50/50 p-5 shadow-sm flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-100 text-success-600">
          <Check size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-surface-900">Tarifa al día</p>
          <p className="mt-1 text-xs text-surface-600">
            Tu tarifa se ajustó hace poco. No hay inflación nueva acumulada todavía.
          </p>
        </div>
      </div>
    );
  }

  const s = calcularSugerencia({
    tarifaActual,
    inflacionAcumulada,
    meses,
  });

  function handleAplicar() {
    if (!esPremium) return;
    startTransition(async () => {
      try {
        await aplicarTarifaSugerida(s.sugerida);
        setAplicada(true);
        toast.success(`Tarifa actualizada a ${formatearMonto(s.sugerida)}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo aplicar.");
      }
    });
  }

  if (aplicada) {
    return (
      <div className="rounded-2xl border border-success-200 bg-success-50/50 p-5 shadow-sm flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-100 text-success-600">
          <Check size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-surface-900">¡Tarifa actualizada!</p>
          <p className="mt-1 text-xs text-surface-600">
            Ahora cobrás <strong>{formatearMonto(s.sugerida)}/hora</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-accent-50 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
          <TrendingUp size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary-700">
            Sugerencia de aumento
          </p>
          <p className="mt-1 text-sm text-surface-700 leading-relaxed">
            Tu última actualización fue hace{" "}
            <strong>{meses} {meses === 1 ? "mes" : "meses"}</strong>.
            La inflación acumulada en ese período fue del{" "}
            <strong>{s.inflacionPct}%</strong>.
          </p>
        </div>
      </div>

      <div className="px-5 mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-surface-200 bg-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
            Tarifa actual
          </p>
          <p className="mt-1 text-lg font-extrabold text-surface-900">
            {formatearMonto(s.actual)}
          </p>
        </div>
        <div className="rounded-xl border border-primary-300 bg-white p-3 ring-1 ring-primary-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary-700">
            Sugerida
          </p>
          <p className="mt-1 text-lg font-extrabold text-primary-700">
            {formatearMonto(s.sugerida)}
          </p>
        </div>
      </div>

      <div className="px-5 mt-4 mb-5 flex items-center gap-2">
        {esPremium ? (
          <button
            type="button"
            onClick={handleAplicar}
            disabled={pending}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 transition-all active:scale-95"
          >
            <Sparkles size={14} />
            {pending ? "Aplicando…" : "Actualizar mi tarifa"}
          </button>
        ) : (
          <Link
            href="/perfil"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:from-amber-500 hover:to-amber-600 transition-all active:scale-95"
          >
            <Crown size={14} /> Aplicar con un click (Premium)
          </Link>
        )}
      </div>

      {ultimoMesDatos && (
        <p className="border-t border-primary-100 bg-white/40 px-5 py-2 text-[10px] text-surface-500 flex items-center gap-1">
          <AlertCircle size={10} />
          Datos INDEC hasta <strong className="ml-0.5">{formatMesLargo(ultimoMesDatos)}</strong>.
        </p>
      )}
    </div>
  );
}
