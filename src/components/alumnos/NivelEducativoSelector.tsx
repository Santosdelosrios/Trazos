"use client";

import { useState, useRef } from "react";

const NIVELES_CATEGORIAS = [
  {
    label: "Primaria",
    color: "bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100",
    activeColor: "bg-primary-600 text-white border-primary-600",
    opciones: ["1° grado", "2° grado", "3° grado", "4° grado", "5° grado", "6° grado", "7° grado"],
  },
  {
    label: "Secundaria",
    color: "bg-accent-50 text-accent-700 border-accent-200 hover:bg-accent-100",
    activeColor: "bg-accent-500 text-white border-accent-500",
    opciones: ["1° año sec.", "2° año sec.", "3° año sec.", "4° año sec.", "5° año sec.", "6° año sec."],
  },
  {
    label: "Otros",
    color: "bg-surface-50 text-surface-700 border-surface-200 hover:bg-surface-100",
    activeColor: "bg-surface-700 text-white border-surface-700",
    opciones: ["Nivel inicial", "Universitario", "Adultos", "Sesión psicopedagógica"],
  },
];

interface Props {
  name: string;
  defaultValue?: string;
  required?: boolean;
}

export default function NivelEducativoSelector({ name, defaultValue = "", required = true }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [showCustom, setShowCustom] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if the current value matches any pill
  const isStandardValue = NIVELES_CATEGORIAS.some(cat => cat.opciones.includes(value));

  const handlePillClick = (nivel: string) => {
    if (value === nivel) {
      // Deselect
      setValue("");
    } else {
      setValue(nivel);
      setShowCustom(false);
    }
  };

  const handleCustomToggle = () => {
    setShowCustom(true);
    setValue("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="space-y-3">
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={value} />

      {NIVELES_CATEGORIAS.map((cat) => (
        <div key={cat.label}>
          <span className="block text-[10px] font-bold uppercase tracking-widest text-surface-400 mb-1.5">
            {cat.label}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {cat.opciones.map((nivel) => (
              <button
                key={nivel}
                type="button"
                onClick={() => handlePillClick(nivel)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-all active:scale-95 ${
                  value === nivel
                    ? cat.activeColor + " shadow-sm"
                    : cat.color
                }`}
              >
                {nivel}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Custom input toggle */}
      <div>
        {!showCustom && !isStandardValue && value === "" ? (
          <button
            type="button"
            onClick={handleCustomToggle}
            className="text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline transition-colors mt-1"
          >
            + Escribir otro nivel
          </button>
        ) : showCustom || (!isStandardValue && value !== "") ? (
          <div className="mt-1">
            <input
              ref={inputRef}
              type="text"
              value={!isStandardValue ? value : ""}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ej: Preuniversitario, CBC, etc."
              className="w-full rounded-xl border border-primary-200 bg-primary-50/30 px-4 py-2 text-sm font-medium focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            <button
              type="button"
              onClick={() => { setShowCustom(false); if (!isStandardValue) setValue(""); }}
              className="text-[10px] font-bold text-surface-400 hover:text-surface-600 mt-1 transition-colors"
            >
              ← Volver a las opciones
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCustomToggle}
            className="text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline transition-colors mt-1"
          >
            + Escribir otro nivel
          </button>
        )}
      </div>

      {/* Validation hint */}
      {required && value === "" && (
        <p className="text-[10px] text-surface-400">
          Seleccioná un nivel o escribí uno personalizado.
        </p>
      )}
    </div>
  );
}
