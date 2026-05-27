"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Crown, Loader2 } from "lucide-react";
import type { BriefingFinanzasRespuesta } from "@/lib/finanzas/briefingFinanzas";

interface Props {
  esPremium: boolean;
}

/**
 * Card del briefing de Tiza en /finanzas.
 *
 * Premium → fetch al endpoint y renderiza el briefing real.
 * Free → preview estático borroso + CTA a /perfil para suscripción.
 */
export default function BriefingTizaCard({ esPremium }: Props) {
  const [briefing, setBriefing] = useState<BriefingFinanzasRespuesta | null>(null);
  const [cargando, setCargando] = useState(esPremium);

  useEffect(() => {
    if (!esPremium) return;
    let cancelado = false;
    fetch("/api/tiza/briefing-finanzas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: BriefingFinanzasRespuesta) => {
        if (!cancelado) {
          setBriefing(data);
          setCargando(false);
        }
      })
      .catch(() => {
        if (!cancelado) setCargando(false);
      });
    return () => { cancelado = true; };
  }, [esPremium]);

  if (!esPremium) {
    return <CardPreviewFree />;
  }

  if (cargando) {
    return (
      <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 via-white to-accent-50 p-5 shadow-sm flex items-center gap-3">
        <Loader2 size={18} className="text-primary-600 animate-spin" />
        <p className="text-sm text-surface-600">Tiza está armando tu briefing del mes…</p>
      </div>
    );
  }

  if (!briefing) {
    // Gemini falló y el endpoint devolvió error. No bloqueamos el dashboard.
    return null;
  }

  return (
    <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 via-white to-accent-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
          <Sparkles size={18} />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary-700">
            Briefing de Tiza
          </p>
          <p className="text-sm font-semibold text-surface-900 leading-relaxed">
            {briefing.saludo}
          </p>
          <p className="text-sm text-surface-700 leading-relaxed">
            {briefing.destacado}
          </p>
          <p className="text-sm text-surface-700 leading-relaxed italic">
            {briefing.accion_sugerida}
          </p>
        </div>
      </div>
    </div>
  );
}

function CardPreviewFree() {
  return (
    <div className="relative rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-surface-50 p-5 shadow-sm overflow-hidden">
      {/* Preview borroso */}
      <div className="flex items-start gap-3 pointer-events-none select-none blur-[3px] opacity-60">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
          <Sparkles size={18} />
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary-700">
            Briefing de Tiza
          </p>
          <p className="text-sm font-semibold text-surface-900">
            Hola Profe. Este mes llevás $XXX.XXX facturados, un +12% más que en el mes anterior.
          </p>
          <p className="text-sm text-surface-700">
            Sofía fue tu mejor alumna con $XX.XXX.
          </p>
          <p className="text-sm text-surface-700 italic">
            Te deben $XX.XXX (3 alumnos). ¿Querés que armemos los recordatorios?
          </p>
        </div>
      </div>

      {/* Overlay CTA */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5 bg-white/30 backdrop-blur-[1px]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg">
          <Crown size={22} />
        </div>
        <p className="mt-2 text-base font-extrabold text-surface-900">
          El briefing de Tiza es Premium
        </p>
        <p className="mt-1 text-xs text-surface-600 max-w-xs">
          Cada día Tiza arma un resumen del estado de tu negocio en lenguaje natural y te sugiere la próxima acción.
        </p>
        <Link
          href="/perfil"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:from-amber-500 hover:to-amber-600 transition-all active:scale-95"
        >
          <Crown size={14} /> Probar Premium
        </Link>
      </div>
    </div>
  );
}
