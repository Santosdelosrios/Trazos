"use client";

import { useState } from "react";
import { AUTOEVALUACION_CONFIG, type Autoevaluacion } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { Frown, Meh, Smile, Sparkles } from "lucide-react";

const ICON_MAP: Record<Autoevaluacion, any> = {
  1: Frown,
  2: Meh,
  3: Smile,
  4: Sparkles,
};

interface PasoAutoevaluacionProps {
  onComplete: (nivel: Autoevaluacion) => void;
}

const NIVELES = Object.entries(AUTOEVALUACION_CONFIG).map(
  ([k, v]) => [Number(k) as Autoevaluacion, v] as const
);

export default function PasoAutoevaluacion({
  onComplete,
}: PasoAutoevaluacionProps) {
  const [selected, setSelected] = useState<Autoevaluacion | null>(null);

  const handleSelect = (nivel: Autoevaluacion) => {
    setSelected(nivel);
    // Agregamos un delay más largo para que el alumno vea la animación
    // y sienta que su respuesta fue registrada antes de avanzar.
    setTimeout(() => {
      onComplete(nivel);
    }, 1000);
  };

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in-up">
      <section className="rounded-2xl border border-surface-200 bg-white p-8 shadow-sm text-center">
        <h2 className="text-xl font-bold tracking-tight text-surface-900 mb-2">
          ¿Cómo te sentís con este tema?
        </h2>
        <p className="text-sm text-surface-700 mb-8">
          Elegí la carita que mejor represente lo que entendiste en la clase de hoy.
          ¡Sé sincero, esto nos ayuda a mejorar!
        </p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {NIVELES.map(([nivel, config]) => {
            const isSelected = selected === nivel;
            const isAnySelected = selected !== null;

            return (
              <button
                key={nivel}
                onClick={() => handleSelect(nivel)}
                disabled={isAnySelected}
                className={cn(
                  "group relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 p-6 transition-all duration-300",
                  isSelected
                    ? "border-transparent bg-white shadow-lg scale-105"
                    : "border-surface-200 bg-surface-50 hover:border-primary-300 hover:bg-white hover:shadow-md",
                  isAnySelected && !isSelected && "opacity-40 grayscale hover:scale-100 cursor-not-allowed"
                )}
                // Aplica el color de forma dinámica solo si está seleccionado o en hover
                style={
                  isSelected
                    ? { borderColor: config.color, boxShadow: `0 10px 25px -5px ${config.color}40` }
                    : {}
                }
              >
                {/* Fondo de color (solo visible al seleccionar) */}
                <div
                  className={cn(
                    "absolute inset-0 rounded-2xl opacity-10 transition-opacity duration-300",
                    isSelected ? "opacity-15" : "opacity-0 group-hover:opacity-5"
                  )}
                  style={{ backgroundColor: config.color }}
                />

                <span className={cn(
                  "relative z-10 transition-transform duration-300",
                  isSelected ? "scale-125" : "group-hover:scale-110"
                )}>
                  {(() => {
                    const Icon = ICON_MAP[nivel];
                    return <Icon size={48} strokeWidth={1.5} style={{ color: config.color }} />;
                  })()}
                </span>

                <span
                  className={cn(
                    "relative z-10 text-sm font-semibold transition-colors duration-300",
                    isSelected ? "text-surface-900" : "text-surface-600 group-hover:text-surface-900"
                  )}
                >
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
