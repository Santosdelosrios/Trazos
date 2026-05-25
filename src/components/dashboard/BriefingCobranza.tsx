"use client";

import Link from "next/link";
import { Wallet, Check, ChevronRight, Sparkles } from "lucide-react";

interface BriefingCobranzaProps {
  count: number;
  total: number;
  nombres: string[];
  esPremium: boolean;
}

export default function BriefingCobranza({ count, total, nombres, esPremium }: BriefingCobranzaProps) {
  const totalFmt = `$${total.toLocaleString("es-AR")}`;

  // Cobros al día
  if (count === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <Check size={20} strokeWidth={2.5} />
        </div>
        <p className="text-sm font-semibold text-white/90">
          Estás al día con los cobros. ¡Todo en orden! 🎉
        </p>
      </div>
    );
  }

  const plural = count === 1 ? "" : "s";
  const verbo = count === 1 ? "tiene" : "tienen";

  // Premium: dispara el flujo organizar_cobro_mes de Tiza
  if (esPremium && nombres.length > 0) {
    const extra = count > nombres.length ? " (y alguna más)" : "";
    const mensaje =
      `Ayudame a armar los recordatorios de cobro de este mes. ` +
      `Las familias con pagos pendientes son: ${nombres.join(", ")}${extra}. ` +
      `Empecemos por ${nombres[0]}.`;

    const abrirTiza = () => {
      window.dispatchEvent(new CustomEvent("tiza:prefill", { detail: { message: mensaje } }));
    };

    return (
      <button
        type="button"
        onClick={abrirTiza}
        className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-white/15 p-4 text-left backdrop-blur-sm transition-colors hover:bg-white/25"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Wallet size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">
              {count} familia{plural} {verbo} pagos pendientes
            </p>
            <p className="truncate text-xs text-white/80">{totalFmt} sin cobrar</p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold">
          <Sparkles size={14} />
          Armar con Tiza
        </span>
      </button>
    );
  }

  // Free (o sin nombres): link a la pantalla de cobranzas
  return (
    <Link
      href="/finanzas/cobranzas"
      className="group flex items-center justify-between gap-3 rounded-2xl bg-white/15 p-4 backdrop-blur-sm transition-colors hover:bg-white/25"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <Wallet size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight">
            {count} familia{plural} {verbo} pagos pendientes
          </p>
          <p className="truncate text-xs text-white/80">{totalFmt} sin cobrar · tocá para gestionar</p>
        </div>
      </div>
      <ChevronRight size={20} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
