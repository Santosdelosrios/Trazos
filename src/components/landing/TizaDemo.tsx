"use client";

import { useEffect, useState } from "react";
import { FileUp, Sparkles, Check } from "lucide-react";

const PASOS = [
  {
    icon: FileUp,
    titulo: "Subís el cuadernillo",
    detalle: "Matemática de 4° · 8 páginas (PDF)",
  },
  {
    icon: Sparkles,
    titulo: "Tiza lo lee",
    detalle: "Lo cruza con lo que ya sabe de tu alumno…",
  },
  {
    icon: Check,
    titulo: "Listo: 10 ejercicios",
    detalle: "Adaptados al nivel de Santi, listos para usar",
  },
];

export default function TizaDemo() {
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    // Respeta a quien prefiere menos movimiento: queda en el paso final.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPaso(PASOS.length - 1);
      return;
    }
    const id = setInterval(() => {
      setPaso((p) => (p + 1) % PASOS.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
      {/* Pasos */}
      <div className="space-y-3">
        {PASOS.map((p, i) => {
          const Icon = p.icon;
          const activo = i === paso;
          const hecho = i < paso;
          return (
            <div
              key={p.titulo}
              aria-current={activo ? "step" : undefined}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-all duration-500 ${
                activo
                  ? "border-accent-300/40 bg-white/[0.08] scale-[1.02]"
                  : "border-white/5 bg-transparent opacity-60"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-500 ${
                  activo || hecho
                    ? "bg-accent-400 text-chalk-900"
                    : "bg-white/10 text-white/60"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-surface-50">{p.titulo}</p>
                <p className="truncate text-xs text-surface-50/60">{p.detalle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resultado: aparece en el último paso */}
      <div
        className={`mt-4 overflow-hidden rounded-xl bg-surface-50 transition-all duration-700 ${
          paso === PASOS.length - 1 ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-primary-600">
            Ejercicio 1 de 10
          </p>
          <p className="text-sm font-bold text-surface-900">
            Resolvé: 3/4 + 2/8 = ?
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <span className="rounded-lg border border-surface-200 px-2 py-1.5 text-surface-600">
              a) 5/12
            </span>
            <span className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1.5 font-bold text-primary-700">
              b) 1
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
