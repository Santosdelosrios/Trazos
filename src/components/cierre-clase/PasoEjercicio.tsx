"use client";

import { useState } from "react";
import type { EjercicioGenerado } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";

interface PasoEjercicioProps {
  ejercicio: EjercicioGenerado;
  numeroEjercicio: number;
  totalEjercicios: number;
  onOptionSelect: (respuestaSeleccionada: string) => void;
}

export default function PasoEjercicio({
  ejercicio,
  numeroEjercicio,
  totalEjercicios,
  onOptionSelect,
}: PasoEjercicioProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleSelect = (key: string) => {
    setSelectedOption(key);
    // Agregamos un pequeño delay para que el alumno vea la selección
    // antes de pasar al siguiente paso de autoevaluación.
    setTimeout(() => {
      onOptionSelect(key);
    }, 600);
  };

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in-up">
      {/* ========================================
          CONSIGNA
          ======================================== */}
      <section className="rounded-2xl border border-surface-200 bg-white p-5 sm:p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-md">
            <Bot size={28} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-primary-700">
              EJERCICIO {numeroEjercicio} DE {totalEjercicios}
            </h2>
            <p className="text-xs text-surface-700">
              Leé con atención y elegí la respuesta correcta.
            </p>
          </div>
        </div>

        <p className="text-lg font-medium text-surface-900 leading-relaxed">
          {ejercicio.consigna}
        </p>
      </section>

      {/* ========================================
          OPCIONES
          ======================================== */}
      <section className="space-y-2.5">
        {ejercicio.opciones.map((opcion) => {
          const isSelected = selectedOption === opcion.key;

          return (
            <button
              key={opcion.key}
              onClick={() => handleSelect(opcion.key)}
              disabled={selectedOption !== null}
              className={cn(
                "group w-full flex items-center gap-3 rounded-xl border-2 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 text-left transition-all duration-200",
                isSelected
                  ? "border-primary-500 bg-primary-50 shadow-sm shadow-primary-200"
                  : "border-surface-200 bg-white hover:border-primary-300 hover:bg-primary-50/50",
                selectedOption !== null && !isSelected && "opacity-50"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-sm transition-colors",
                  isSelected
                    ? "bg-primary-500 text-white"
                    : "bg-surface-100 text-surface-700 group-hover:bg-primary-100 group-hover:text-primary-700",
                  selectedOption !== null && isSelected && opcion.key === ejercicio.respuesta_correcta && "bg-success-500 text-white",
                  selectedOption !== null && isSelected && opcion.key !== ejercicio.respuesta_correcta && "bg-danger-500 text-white"
                )}
              >
                {opcion.key.toUpperCase()}
              </div>
              <span
                className={cn(
                  "text-base font-medium",
                  isSelected ? "text-primary-900" : "text-surface-800"
                )}
              >
                {opcion.texto}
              </span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
