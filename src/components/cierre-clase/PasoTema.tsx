"use client";

import { useState, useCallback } from "react";
import {
  type Nivel,
} from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { FileText, X, AlertCircle, BookOpen, GraduationCap, Sparkles, PenTool, Loader2 } from "lucide-react";

// ============================================================
// Tipos internos del componente
// ============================================================

export interface AlumnoBasico {
  id: string;
  nombre: string;
  apellido: string;
  grado: Nivel;
}

interface PasoTemaData {
  temas: string[];
  alumno_id: string | null;
}

interface PasoTemaProps {
  alumnos: AlumnoBasico[];
  /** Callback cuando el/la profe completa el paso y quiere generar el ejercicio */
  onSubmit?: (data: {
    temas: string[];
    nivel_target: string;
    alumno_id: string;
  }) => Promise<void>;
  initialAlumnoId?: string;
  initialTema?: string;
  sugerencias?: string[];
}

// ============================================================
// Constantes
// ============================================================

const TEMA_SUGGESTIONS = [
  "Suma y resta con dificultad",
  "Sustantivos propios y comunes",
  "Los estados del agua",
  "Las regiones de Argentina",
  "Tablas de multiplicar del 6 al 9",
  "El cuento: partes y estructura",
];

// ============================================================
// Componente principal
// ============================================================

export default function PasoTema({ 
  alumnos, 
  onSubmit, 
  initialAlumnoId,
  initialTema,
  sugerencias = TEMA_SUGGESTIONS,
}: PasoTemaProps) {
  const [data, setData] = useState<PasoTemaData>({
    temas: initialTema ? [initialTema] : [],
    alumno_id: initialAlumnoId || null,
  });
  const [currentInput, setCurrentInput] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof PasoTemaData, string>>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Handlers ---

  const updateField = useCallback(
    <K extends keyof PasoTemaData>(field: K, value: PasoTemaData[K]) => {
      setData((prev) => ({ ...prev, [field]: value }));
      // Clear error on change
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    []
  );

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof PasoTemaData, string>> = {};

    if (data.temas.length === 0) {
      newErrors.temas = "Agregá al menos un tema para la clase.";
    }
    if (!data.alumno_id) {
      newErrors.alumno_id = "Seleccioná un alumno.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [data]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    setIsGenerating(true);

    if (onSubmit) {
      try {
        const alumno = alumnos.find((a) => a.id === data.alumno_id);
        await onSubmit({
          temas: data.temas,
          nivel_target: String(alumno!.grado),
          alumno_id: data.alumno_id!,
        });
      } catch (error) {
        console.error("Error al generar ejercicio:", error);
      }
    } else {
      // Simular llamada a la API si no hay onSubmit (para preview)
      await new Promise((r) => setTimeout(r, 2000));
    }
    
    setIsGenerating(false);
  }, [data, validate, onSubmit, alumnos]);

  // --- Computed ---

  const isComplete = data.temas.length > 0 && data.alumno_id;
  const alumnoSeleccionado = alumnos.find((a) => a.id === data.alumno_id);

  const addTema = (tema: string) => {
    const trimmed = tema.trim();
    if (trimmed.length >= 3 && !data.temas.includes(trimmed) && data.temas.length < 4) {
      setData((prev) => ({ ...prev, temas: [...prev.temas, trimmed] }));
      setCurrentInput("");
      setErrors((prev) => ({ ...prev, temas: undefined }));
    }
  };

  const removeTema = (index: number) => {
    setData((prev) => ({
      ...prev,
      temas: prev.temas.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* ========================================
          SECCIÓN 1: Tema de la clase
          ======================================== */}
      <section className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
            <FileText size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900">
              ¿Qué tema vieron hoy?
            </h2>
            <p className="text-xs text-surface-700">
              Escribí el tema principal de la clase.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Tag display */}
          <div className="flex flex-wrap gap-2">
            {data.temas.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1.5 text-sm font-medium text-primary-700 animate-in fade-in zoom-in duration-200"
              >
                <span>{t}</span>
                <button
                  type="button"
                  onClick={() => removeTema(i)}
                  className="rounded-full p-0.5 hover:bg-primary-200 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTema(currentInput);
                }
              }}
              placeholder={data.temas.length === 0 ? "Ej: Suma y resta, sustantivos..." : "Agregar otro tema..."}
              disabled={data.temas.length >= 4}
              className={cn(
                "w-full rounded-xl border bg-surface-50 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-700/40 transition-all focus:outline-none focus:ring-2",
                errors.temas
                  ? "border-danger-400 focus:border-danger-400 focus:ring-danger-400/20"
                  : "border-surface-200 focus:border-primary-400 focus:ring-primary-200"
              )}
            />
            {data.temas.length > 0 && (
              <span className="absolute right-3 top-3 text-[10px] text-surface-400 uppercase font-bold tracking-wider">
                {data.temas.length}/4 temas
              </span>
            )}
          </div>
        </div>

        {errors.temas && (
          <p className="mt-2 flex items-center gap-1 text-xs text-danger-500 font-bold">
            <AlertCircle size={12} /> {errors.temas}
          </p>
        )}

        {/* Quick suggestions */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-surface-700">
            💡 Sugerencias rápidas:
          </p>
          <div className="flex flex-wrap gap-2">
            {sugerencias.map((suggestion) => {
              const isAdded = data.temas.includes(suggestion);
              return (
                <button
                  key={suggestion}
                  type="button"
                  disabled={isAdded || data.temas.length >= 4}
                  onClick={() => addTema(suggestion)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs transition-all duration-200 active:scale-95",
                    isAdded
                      ? "border-primary-200 bg-primary-50 text-primary-400 cursor-not-allowed"
                      : "border-surface-200 bg-surface-50 text-surface-700 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                  )}
                >
                  {suggestion}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================
          SECCIÓN 2: Alumno (reemplaza a Materia y Grado)
          ======================================== */}
      <section className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-400/15 text-success-600">
            <GraduationCap size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-surface-900">Alumno</h2>
            <p className="text-xs text-surface-700">
              ¿A quién le diste la clase?
            </p>
          </div>
        </div>

        {alumnos.length === 0 ? (
          <div className="rounded-xl border border-warning-200 bg-warning-50 p-4">
            <p className="text-sm text-warning-800">
              Todavía no agregaste ningún alumno.{" "}
              <a href="/alumnos" className="font-semibold underline">
                Ir a agregar alumnos
              </a>
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {alumnos.map((alumno) => {
              const isSelected = data.alumno_id === alumno.id;
              return (
                <button
                  key={alumno.id}
                  type="button"
                  id={`alumno-${alumno.id}`}
                  onClick={() => updateField("alumno_id", alumno.id)}
                  className={cn(
                    "rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 active:scale-95 flex items-center gap-2",
                    isSelected
                      ? "border-primary-500 bg-primary-50 text-primary-700 shadow-sm shadow-primary-200"
                      : "border-transparent bg-surface-50 text-surface-700 hover:border-surface-200 hover:bg-surface-100"
                  )}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-200 text-[10px] font-bold text-surface-600">
                    {alumno.nombre.charAt(0).toUpperCase()}
                  </div>
                  {alumno.nombre} {alumno.apellido}
                </button>
              );
            })}
          </div>
        )}

        {errors.alumno_id && (
          <p className="mt-3 flex items-center gap-1 text-xs text-danger-500 font-bold">
            <AlertCircle size={12} /> {errors.alumno_id}
          </p>
        )}
      </section>

      {/* ========================================
          BOTÓN: Generar ejercicio
          ======================================== */}
      <div className="flex items-center justify-between rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
        {/* Preview of selection */}
        <div className="text-sm text-surface-700">
          {isComplete ? (
            <span className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-success-500" />
              {alumnoSeleccionado?.nombre} {alumnoSeleccionado?.apellido}
            </span>
          ) : (
            <span className="text-xs italic text-surface-700/60">
              Completá todos los campos para continuar
            </span>
          )}
        </div>

        <button
          id="btn-generar-ejercicio"
          type="button"
          disabled={!isComplete || isGenerating || alumnos.length === 0}
          onClick={handleSubmit}
          className={cn(
            "relative flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-md transition-all duration-200",
            isComplete && !isGenerating && alumnos.length > 0
              ? "bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 hover:shadow-lg active:scale-[0.98]"
              : "cursor-not-allowed bg-surface-200 text-surface-700/50"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generando con IA...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generar Ejercicio con IA
            </>
          )}
        </button>
      </div>
    </div>
  );
}
