"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { planificarClase } from "../actions";
import { CalendarDays, X, ChevronLeft, ChevronRight, RefreshCw, Info } from "lucide-react";
import type { Feriado } from "@/lib/utils/feriados";
import type { Materia } from "@/lib/types/database";

export default function PlanificarModal({
  open,
  onClose,
  alumnos,
  tarifaActual,
  prefillDate,
  feriados,
}: {
  open: boolean;
  onClose: () => void;
  alumnos: { id: string; nombre: string; apellido: string }[];
  tarifaActual: number | null;
  prefillDate?: string;
  feriados: Record<string, Feriado>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    alumno_id: "",
    fecha: prefillDate || new Date().toISOString().split("T")[0],
    hora: "09:00",
    tema_previsto: "",
    materia: "general" as Materia,
    duracion_estimada: 1,
    tarifa_esperada: tarifaActual || 0,
    repetirSemanal: false,
    semanas: 4,
  });

  const resetForm = () => {
    setStep(1);
    setFormData({
      alumno_id: "",
      fecha: prefillDate || new Date().toISOString().split("T")[0],
      hora: "09:00",
      tema_previsto: "",
      materia: "otro" as Materia,
      duracion_estimada: 1,
      tarifa_esperada: tarifaActual || 0,
      repetirSemanal: false,
      semanas: 4,
    });
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.alumno_id) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await planificarClase(formData);
      resetForm();
      onClose();
    } catch (error: unknown) {
      setErrorMsg("Error: " + ((error as Error).message || "No se pudo agendar la clase"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-surface-900/30 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-2xl border border-surface-200 bg-white shadow-2xl animate-fade-in-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-100 bg-primary-50/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
              <CalendarDays size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-surface-900">Planificar Clase</h2>
              <p className="text-[10px] font-medium text-surface-500">Paso {step} de 2</p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex gap-1 px-6 pt-4">
          <div className={cn("h-1 flex-1 rounded-full transition-colors", step >= 1 ? "bg-primary-500" : "bg-surface-200")} />
          <div className={cn("h-1 flex-1 rounded-full transition-colors", step >= 2 ? "bg-primary-500" : "bg-surface-200")} />
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {errorMsg && (
            <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-600 border border-danger-100">
              {errorMsg}
            </div>
          )}
          {step === 1 && (
            <>
              {/* Step 1: Quién y Cuándo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-surface-700 uppercase">Alumno</label>
                <select
                  required
                  value={formData.alumno_id}
                  onChange={(e) => setFormData({ ...formData, alumno_id: e.target.value })}
                  className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                >
                  <option value="">Seleccioná un alumno</option>
                  {alumnos.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-surface-700 uppercase">Fecha</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-surface-700 uppercase">Hora</label>
                  <input
                    type="time"
                    required
                    value={formData.hora}
                    onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                  />
                </div>
              </div>

              {feriados[formData.fecha] && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 border border-amber-100">
                  <Info size={14} className="text-amber-600 shrink-0" />
                  <p className="text-[10px] font-medium text-amber-800 leading-tight">
                    Ojo: El {new Date(formData.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: 'numeric', month: 'long' })} es feriado: <span className="font-bold">{feriados[formData.fecha].motivo}</span>.
                  </p>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={!formData.alumno_id}
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* Step 2: Qué y Cuánto */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-surface-700 uppercase">Tema Previsto</label>
                <input
                  type="text"
                  placeholder="Ej: Fracciones equivalentes..."
                  value={formData.tema_previsto}
                  onChange={(e) => setFormData({ ...formData, tema_previsto: e.target.value })}
                  className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-surface-700 uppercase">Duración (hs)</label>
                  <input
                    type="number" min="0.5" step="0.5" required
                    value={formData.duracion_estimada}
                    onChange={(e) => {
                      const dur = Number(e.target.value);
                      setFormData({ ...formData, duracion_estimada: dur, tarifa_esperada: (tarifaActual || 0) * dur });
                    }}
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-surface-700 uppercase">Total ARS</label>
                  <input
                    type="number" min="0" step="100" required
                    value={formData.tarifa_esperada}
                    onChange={(e) => setFormData({ ...formData, tarifa_esperada: Number(e.target.value) })}
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                  />
                </div>
              </div>

              {/* Recurrencia */}
              <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={16} className="text-primary-600" />
                    <span className="text-xs font-bold text-surface-700">Repetir semanalmente</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.repetirSemanal}
                    onChange={(e) => setFormData({ ...formData, repetirSemanal: e.target.checked })}
                    className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
                {formData.repetirSemanal && (
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-[10px] font-medium text-surface-500">Semanas:</label>
                    <input
                      type="number" min="2" max="12"
                      value={formData.semanas}
                      onChange={(e) => setFormData({ ...formData, semanas: Number(e.target.value) })}
                      className="w-16 rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-between">
                <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 text-sm font-medium text-surface-500 hover:text-surface-700 transition-colors">
                  <ChevronLeft size={16} /> Atrás
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-surface-900 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-surface-800 transition-all active:scale-95 disabled:opacity-40"
                >
                  {isSubmitting ? "Guardando..." : "Confirmar"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
