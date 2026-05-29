"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { planificarClase } from "../actions";
import { CalendarDays, X, ChevronLeft, ChevronRight, RefreshCw, Info, Target, Bell, Plus, Trash2, History } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { calcularMontoClase, type TipoTarifa } from "@/lib/finanzas/calcularMontoClase";
import type { Feriado } from "@/lib/utils/feriados";
import type { Materia } from "@/lib/types/database";

// Etiquetas de días de la semana (0=domingo según JS Date.getDay()).
const DIAS_LABELS = ["D", "L", "M", "M", "J", "V", "S"] as const;
const DIAS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;

export default function PlanificarModal({
  open,
  onClose,
  alumnos,
  tarifaActual,
  tipoTarifa = "por_hora",
  prefillDate,
  prefillAlumnoId,
  feriados,
}: {
  open: boolean;
  onClose: () => void;
  alumnos: { id: string; nombre: string; apellido: string }[];
  tarifaActual: number | null;
  /** Tipo de tarifa global de la maestra. Determina si el monto se
   *  calcula como tarifa × duración (por_hora) o fijo (por_clase). */
  tipoTarifa?: TipoTarifa;
  prefillDate?: string;
  /** Si viene, el modal salta el selector de alumno y arranca en step 2. */
  prefillAlumnoId?: string;
  feriados: Record<string, Feriado>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(prefillAlumnoId ? 2 : 1);
  const [formData, setFormData] = useState({
    alumno_id: prefillAlumnoId || "",
    fecha: prefillDate || new Date().toISOString().split("T")[0],
    hora: "09:00",
    tema_previsto: "",
    materia: "general" as Materia,
    duracion_estimada: 1,
    // tarifa_esperada se deriva con calcularMontoClase: si tipo='por_hora'
    // es tarifa × duración; si 'por_clase' es el valor fijo.
    tarifa_esperada: calcularMontoClase(tarifaActual || 0, tipoTarifa, 1),
    repetirSemanal: false,
    semanas: 4,
    diasSemana: [] as number[],  // 0=domingo, 1=lunes, ..., 6=sábado
    objetivos: [] as string[],
    recordatorios: [] as { id: string; texto: string; completado: boolean }[],
  });
  // Inputs locales para agregar objetivos/recordatorios uno por uno.
  const [nuevoObjetivo, setNuevoObjetivo] = useState("");
  const [nuevoRecordatorio, setNuevoRecordatorio] = useState("");
  // Sugerencia de continuidad: plan_proxima de la última clase del
  // alumno seleccionado. Se ofrece al primer cambio de alumno como
  // "agregar como objetivo" para no romper si la maestra ya empezó
  // a escribir objetivos propios.
  const [sugerenciaPlan, setSugerenciaPlan] = useState<string | null>(null);
  const [sugerenciaAceptada, setSugerenciaAceptada] = useState(false);

  // Reset interno cuando cambian las props de prefill (modal reabierto
  // con distinto contexto, por ej. distinto alumno).
  useEffect(() => {
    if (open) {
      setStep(prefillAlumnoId ? 2 : 1);
      setFormData((prev) => ({
        ...prev,
        alumno_id: prefillAlumnoId || prev.alumno_id,
        fecha: prefillDate || prev.fecha,
      }));
    }
  }, [open, prefillAlumnoId, prefillDate]);

  // Cuando cambia el alumno seleccionado, traer el plan_proxima de su
  // última clase para sugerirlo como objetivo (continuidad pedagógica).
  useEffect(() => {
    const alumnoId = formData.alumno_id;
    if (!open || !alumnoId) {
      setSugerenciaPlan(null);
      setSugerenciaAceptada(false);
      return;
    }
    setSugerenciaAceptada(false);
    const supa = createClient();
    (async () => {
      const { data } = await supa
        .from("clases")
        .select("plan_proxima, clase_alumnos!inner(alumno_id)")
        .eq("clase_alumnos.alumno_id", alumnoId)
        .not("plan_proxima", "is", null)
        .order("fecha", { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = data as { plan_proxima: string } | null;
      if (row?.plan_proxima && row.plan_proxima.trim() !== "") {
        setSugerenciaPlan(row.plan_proxima);
      } else {
        setSugerenciaPlan(null);
      }
    })().catch(() => setSugerenciaPlan(null));
  }, [open, formData.alumno_id]);

  // Reset interno cuando cambian las props de prefill (modal reabierto
  // con distinto contexto, por ej. distinto alumno).
  useEffect(() => {
    if (open) {
      setStep(prefillAlumnoId ? 2 : 1);
      setFormData((prev) => ({
        ...prev,
        alumno_id: prefillAlumnoId || prev.alumno_id,
        fecha: prefillDate || prev.fecha,
      }));
    }
  }, [open, prefillAlumnoId, prefillDate]);

  const resetForm = () => {
    setStep(prefillAlumnoId ? 2 : 1);
    setFormData({
      alumno_id: prefillAlumnoId || "",
      fecha: prefillDate || new Date().toISOString().split("T")[0],
      hora: "09:00",
      tema_previsto: "",
      materia: "otro" as Materia,
      duracion_estimada: 1,
      tarifa_esperada: calcularMontoClase(tarifaActual || 0, tipoTarifa, 1),
      repetirSemanal: false,
      semanas: 4,
      diasSemana: [],
      objetivos: [],
      recordatorios: [],
    });
    setNuevoObjetivo("");
    setNuevoRecordatorio("");
  };

  // Helpers para gestión inline de objetivos / recordatorios.
  const agregarObjetivo = () => {
    const t = nuevoObjetivo.trim();
    if (!t || formData.objetivos.length >= 20) return;
    setFormData({ ...formData, objetivos: [...formData.objetivos, t] });
    setNuevoObjetivo("");
  };
  const quitarObjetivo = (idx: number) => {
    setFormData({
      ...formData,
      objetivos: formData.objetivos.filter((_, i) => i !== idx),
    });
  };
  const agregarRecordatorio = () => {
    const t = nuevoRecordatorio.trim();
    if (!t || formData.recordatorios.length >= 20) return;
    setFormData({
      ...formData,
      recordatorios: [
        ...formData.recordatorios,
        {
          // ID estable client-side; server lo respeta para luego matchearlo
          // cuando se marca como completado desde el widget En Vivo.
          id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          texto: t,
          completado: false,
        },
      ],
    });
    setNuevoRecordatorio("");
  };
  const quitarRecordatorio = (id: string) => {
    setFormData({
      ...formData,
      recordatorios: formData.recordatorios.filter((r) => r.id !== id),
    });
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.alumno_id) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      // Solo mandamos diasSemana si el usuario marcó al menos un día
      // distinto. Si la lista está vacía, dejamos que el server caiga
      // al comportamiento default (el día de la fecha ancla).
      await planificarClase({
        ...formData,
        diasSemana: formData.repetirSemanal && formData.diasSemana.length > 0
          ? formData.diasSemana
          : undefined,
      });
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

  const toggleDia = (dia: number) => {
    setFormData((prev) => ({
      ...prev,
      diasSemana: prev.diasSemana.includes(dia)
        ? prev.diasSemana.filter((d) => d !== dia)
        : [...prev.diasSemana, dia].sort((a, b) => a - b),
    }));
  };

  if (!open) return null;

  const alumnoPrefijado = prefillAlumnoId
    ? alumnos.find((a) => a.id === prefillAlumnoId)
    : null;

  // Si la fecha ancla tiene día propio y no está marcado en diasSemana,
  // mostramos un hint para que la maestra entienda qué días se van a generar.
  const diasEfectivos = formData.repetirSemanal && formData.diasSemana.length > 0
    ? formData.diasSemana
    : [new Date(formData.fecha + "T12:00:00").getDay()];

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
              <h2 className="text-base font-bold text-surface-900">
                {alumnoPrefijado
                  ? `Agendar clase para ${alumnoPrefijado.nombre}`
                  : "Planificar Clase"}
              </h2>
              <p className="text-[10px] font-medium text-surface-500">
                {prefillAlumnoId ? "Cuándo y qué" : `Paso ${step} de 2`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Steps indicator (solo si no hay alumno prefijado) */}
        {!prefillAlumnoId && (
          <div className="flex gap-1 px-6 pt-4">
            <div className={cn("h-1 flex-1 rounded-full transition-colors", step >= 1 ? "bg-primary-500" : "bg-surface-200")} />
            <div className={cn("h-1 flex-1 rounded-full transition-colors", step >= 2 ? "bg-primary-500" : "bg-surface-200")} />
          </div>
        )}

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
              {/* Si vinimos prefijados, mostramos fecha/hora acá también
                  porque el step 1 quedó saltado. */}
              {prefillAlumnoId && (
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
              )}

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
                      setFormData({ ...formData, duracion_estimada: dur, tarifa_esperada: calcularMontoClase(tarifaActual || 0, tipoTarifa, dur) });
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
              <div className="rounded-xl border border-surface-200 bg-surface-50 p-3 space-y-3">
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
                  <>
                    {/* Selector de días */}
                    <div>
                      <label className="text-[10px] font-bold text-surface-500 uppercase block mb-1.5">
                        Días de la semana
                      </label>
                      <div className="flex gap-1">
                        {DIAS_LABELS.map((label, dia) => {
                          const selected = diasEfectivos.includes(dia);
                          const isDefault = formData.diasSemana.length === 0
                            && dia === new Date(formData.fecha + "T12:00:00").getDay();
                          return (
                            <button
                              key={dia}
                              type="button"
                              onClick={() => toggleDia(dia)}
                              title={DIAS_FULL[dia]}
                              className={cn(
                                "flex-1 h-9 rounded-lg text-xs font-bold transition-all",
                                selected
                                  ? "bg-primary-600 text-white shadow-sm"
                                  : "bg-white text-surface-500 border border-surface-200 hover:border-primary-300",
                                isDefault && "ring-2 ring-primary-200",
                              )}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-surface-500 mt-1.5">
                        {formData.diasSemana.length === 0
                          ? `Se repite los ${DIAS_FULL[new Date(formData.fecha + "T12:00:00").getDay()].toLowerCase()} (día de la fecha).`
                          : `Se repite ${formData.diasSemana.map((d) => DIAS_FULL[d].toLowerCase()).join(", ")}.`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-medium text-surface-500">Semanas:</label>
                      <input
                        type="number" min="2" max="12"
                        value={formData.semanas}
                        onChange={(e) => setFormData({ ...formData, semanas: Number(e.target.value) })}
                        className="w-16 rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Bitácora pedagógica: objetivos y recordatorios */}
              <div className="rounded-xl border border-surface-200 bg-surface-50 p-3 space-y-4">
                <p className="text-xs font-bold text-surface-700">Bitácora pedagógica <span className="font-normal text-surface-400">(opcional)</span></p>

                {/* Objetivos */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-primary-600" />
                    <label className="text-[11px] font-bold uppercase text-surface-600">
                      Objetivos de la clase
                    </label>
                  </div>
                  {sugerenciaPlan && !sugerenciaAceptada && formData.objetivos.length === 0 && (
                    <div className="rounded-lg border border-primary-200 bg-primary-50/60 p-2.5 space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        <History size={11} className="text-primary-600 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase text-primary-700">
                            Sugerido de la última clase
                          </p>
                          <p className="text-xs text-surface-700 mt-0.5">{sugerenciaPlan}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => setSugerenciaAceptada(true)}
                          className="text-[10px] font-bold text-surface-500 hover:text-surface-700 px-2 py-1"
                        >
                          Descartar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              objetivos: [...formData.objetivos, sugerenciaPlan],
                            });
                            setSugerenciaAceptada(true);
                          }}
                          className="text-[10px] font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-md px-2 py-1"
                        >
                          Usar como objetivo
                        </button>
                      </div>
                    </div>
                  )}
                  {formData.objetivos.length > 0 && (
                    <ul className="space-y-1.5">
                      {formData.objetivos.map((obj, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between gap-2 rounded-lg bg-white border border-surface-200 px-3 py-1.5 text-xs"
                        >
                          <span className="flex-1 text-surface-700">{obj}</span>
                          <button
                            type="button"
                            onClick={() => quitarObjetivo(idx)}
                            className="text-surface-400 hover:text-danger-500"
                            aria-label="Quitar objetivo"
                          >
                            <Trash2 size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej: Repasar suma de fracciones"
                      value={nuevoObjetivo}
                      maxLength={200}
                      onChange={(e) => setNuevoObjetivo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          agregarObjetivo();
                        }
                      }}
                      className="flex-1 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-200"
                    />
                    <button
                      type="button"
                      onClick={agregarObjetivo}
                      disabled={!nuevoObjetivo.trim() || formData.objetivos.length >= 20}
                      className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-700 disabled:opacity-40"
                    >
                      <Plus size={12} /> Agregar
                    </button>
                  </div>
                </div>

                {/* Recordatorios */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-warning-600" />
                    <label className="text-[11px] font-bold uppercase text-surface-600">
                      Recordatorios
                    </label>
                  </div>
                  {formData.recordatorios.length > 0 && (
                    <ul className="space-y-1.5">
                      {formData.recordatorios.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-white border border-surface-200 px-3 py-1.5 text-xs"
                        >
                          <span className="flex-1 text-surface-700">{r.texto}</span>
                          <button
                            type="button"
                            onClick={() => quitarRecordatorio(r.id)}
                            className="text-surface-400 hover:text-danger-500"
                            aria-label="Quitar recordatorio"
                          >
                            <Trash2 size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej: Pedir el cuaderno nuevo"
                      value={nuevoRecordatorio}
                      maxLength={200}
                      onChange={(e) => setNuevoRecordatorio(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          agregarRecordatorio();
                        }
                      }}
                      className="flex-1 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-200"
                    />
                    <button
                      type="button"
                      onClick={agregarRecordatorio}
                      disabled={!nuevoRecordatorio.trim() || formData.recordatorios.length >= 20}
                      className="flex items-center gap-1 rounded-lg bg-warning-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-warning-700 disabled:opacity-40"
                    >
                      <Plus size={12} /> Agregar
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-between">
                {!prefillAlumnoId ? (
                  <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 text-sm font-medium text-surface-500 hover:text-surface-700 transition-colors">
                    <ChevronLeft size={16} /> Atrás
                  </button>
                ) : <span />}
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
