"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { type AgendaItem } from "@/lib/types/database";
import { planificarClase, eliminarPlanificacion } from "./actions";
import {
  CalendarDays, Sparkles, RefreshCw, X, Plus,
  ChevronLeft, ChevronRight, Rocket, Trash2, Clock, History,
  CalendarSync, Copy, Check, Crown
} from "lucide-react";
import type { ClaseCerrada } from "./page";

interface AgendaClientProps {
  initialAgenda: AgendaItem[];
  alumnos: any[];
  tarifaActual: number | null;
  clasesCerradas: ClaseCerrada[];
  plan?: "free" | "premium";
  calendarToken?: string | null;
}
import { getFeriados, formatFeriadoDate, type Feriado } from "@/lib/utils/feriados";
import { Info } from "lucide-react";

// --- Helpers ---
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatDateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

// --- Modal Component ---
function PlanificarModal({
  open, onClose, alumnos, tarifaActual, prefillDate, feriados,
}: {
  open: boolean;
  onClose: () => void;
  alumnos: any[];
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
    materia: "general" as any,
    duracion_estimada: 1,
    tarifa_esperada: tarifaActual || 0,
    repetirSemanal: false,
    semanas: 4,
  });

  // Reset when date changes from outside
  const resetForm = () => {
    setStep(1);
    setFormData({
      alumno_id: "",
      fecha: prefillDate || new Date().toISOString().split("T")[0],
      hora: "09:00",
      tema_previsto: "",
      materia: "otro" as any,
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
    } catch (error: any) {
      setErrorMsg("Error: " + (error.message || "No se pudo agendar la clase"));
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

// --- Main Component ---
export default function AgendaClient({ initialAgenda, alumnos, tarifaActual, clasesCerradas, plan = "free", calendarToken }: AgendaClientProps) {
  const [mounted, setMounted] = useState(false);
  const [today, setToday] = useState<Date>(() => new Date("2026-01-01T00:00:00"));
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date("2026-01-01T00:00:00")));
  const [modalOpen, setModalOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [showCerradas, setShowCerradas] = useState(false);
  const [calendarCopied, setCalendarCopied] = useState(false);
  const [feriados, setFeriados] = useState<Record<string, Feriado>>({});
  const [calendarUrl, setCalendarUrl] = useState<string>("");

  useEffect(() => {
    if (calendarToken) {
      setCalendarUrl(`${window.location.origin}/api/calendar/${calendarToken}`);
    }
  }, [calendarToken]);

  useEffect(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    setToday(t);
    setCurrentMonday(getMonday(t));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const controller = new AbortController();
    
    const fetchFeriados = async () => {
      try {
        const year = currentMonday.getFullYear();
        const data = await getFeriados(year);
        if (controller.signal.aborted) return;
        
        const map: Record<string, Feriado> = {};
        data.forEach(f => {
          map[formatFeriadoDate(f, year)] = f;
        });
        setFeriados(prev => ({ ...prev, ...map }));
      } catch (e) {
        console.error(e);
      }
    };
    fetchFeriados();
    
    return () => controller.abort();
  }, [currentMonday, mounted]);

  const weekDays = useMemo(() => getWeekDays(currentMonday), [currentMonday]);

  const pendingItems = useMemo(
    () => initialAgenda.filter((i) => i.estado === "pendiente"),
    [initialAgenda]
  );

  // Group agenda items by date key
  const itemsByDate = useMemo(() => {
    const map: Record<string, AgendaItem[]> = {};
    for (const item of pendingItems) {
      const key = item.fecha;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    // Sort each day's items by hora
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.hora.localeCompare(b.hora));
    }
    return map;
  }, [pendingItems]);

  const prevWeek = () => {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() - 7);
    setCurrentMonday(d);
  };

  const nextWeek = () => {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() + 7);
    setCurrentMonday(d);
  };

  const goToday = () => setCurrentMonday(getMonday(today));

  const openModalForDate = (date: Date) => {
    setPrefillDate(formatDateKey(date));
    setModalOpen(true);
  };

  const openModal = () => {
    setPrefillDate(undefined);
    setModalOpen(true);
  };

  const handleEliminar = async (id: string) => {
    if (confirm("¿Eliminar esta planificación?")) {
      try {
        await eliminarPlanificacion(id);
      } catch (error: any) {
        alert("Error al eliminar: " + (error.message || "Intentá de nuevo"));
      }
    }
  };

  const handleCopyCalendar = () => {
    if (calendarUrl) {
      navigator.clipboard.writeText(calendarUrl);
      setCalendarCopied(true);
      setTimeout(() => setCalendarCopied(false), 2000);
    }
  };

  // Week range label
  const weekLabel = useMemo(() => {
    const sunday = new Date(currentMonday);
    sunday.setDate(currentMonday.getDate() + 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
    return `${fmt(currentMonday)} — ${fmt(sunday)}`;
  }, [currentMonday]);

  const isCurrentWeek = mounted ? isSameDay(currentMonday, getMonday(today)) : false;

  if (!mounted) {
    return (
      <div className="space-y-6 animate-fade-in-up opacity-60 pointer-events-none">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-8 w-48 rounded-lg bg-surface-200 animate-pulse"></div>
          <div className="h-10 w-32 rounded-xl bg-surface-200 animate-pulse"></div>
        </div>
        <div className="h-12 w-full rounded-2xl bg-surface-200 animate-pulse"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-[140px] rounded-2xl bg-surface-200 animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-surface-900">
            <CalendarDays className="text-primary-600" size={28} /> Agenda
          </h1>
          <p className="mt-1 text-sm text-surface-500">
            Tu semana de clases de un vistazo.
          </p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-primary-700 transition-all active:scale-95"
        >
          <Plus size={16} strokeWidth={2.5} /> Planificar Clase
        </button>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between rounded-2xl border border-surface-200 bg-white p-3 shadow-sm">
        <button onClick={prevWeek} className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-900 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          {!isCurrentWeek && (
            <button onClick={goToday} className="rounded-lg bg-primary-50 px-3 py-1 text-[10px] font-bold text-primary-700 hover:bg-primary-100 transition-colors">
              Hoy
            </button>
          )}
          <span className="text-sm font-bold text-surface-900">{weekLabel}</span>
        </div>
        <button onClick={nextWeek} className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-900 transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Calendar Sync Section */}
      {plan === "premium" && calendarUrl && (
        <div className="rounded-2xl bg-white border border-surface-200 shadow-sm p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 shrink-0">
              <CalendarSync size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-surface-900">Sincronizar con Google Calendar</h3>
              <p className="text-xs text-surface-500 mt-0.5">Pegá este link en "Otros calendarios → Desde URL"</p>
            </div>
          </div>
          <div className="flex items-center gap-2 max-w-full sm:max-w-[250px]">
            <div className="flex-1 rounded-lg bg-surface-50 border border-surface-200 px-3 py-2 text-xs text-surface-600 font-mono truncate">
              {calendarUrl}
            </div>
            <button
              onClick={handleCopyCalendar}
              className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-bold text-white hover:bg-primary-700 transition-colors shrink-0"
            >
              {calendarCopied ? <Check size={14} /> : <Copy size={14} />}
              {calendarCopied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      {plan === "free" && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shrink-0">
              <CalendarSync size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">Sincronizar con Google Calendar</h3>
              <p className="text-xs text-amber-700 mt-0.5">Llevá tu agenda a todos lados.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/perfil" className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-xs font-bold text-white hover:from-amber-500 hover:to-amber-600 transition-colors shadow-sm whitespace-nowrap">
              <Crown size={14} /> Ser Premium
            </Link>
          </div>
        </div>
      )}

      {/* Weekly calendar grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {weekDays.map((date, i) => {
          const key = formatDateKey(date);
          const items = itemsByDate[key] || [];
          const isToday = isSameDay(date, today);
          const isPast = date < today && !isToday;

          return (
            <div
              key={key}
              className={cn(
                "group relative flex flex-col rounded-2xl border bg-white p-3 min-h-[140px] transition-all duration-200",
                isToday
                  ? "border-primary-300 bg-primary-50/30 shadow-md ring-1 ring-primary-200"
                  : isPast
                    ? "border-surface-100 bg-surface-50/50 opacity-60"
                    : "border-surface-200 hover:shadow-sm"
              )}
            >
              {/* Day header */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    isToday ? "text-primary-600" : "text-surface-400"
                  )}>
                    {DIAS[i]}
                  </span>
                  <p className={cn(
                    "text-lg font-black leading-none",
                    isToday ? "text-primary-700" : "text-surface-900"
                  )}>
                    {date.getDate()}
                  </p>
                  {feriados[key] && (
                    <span className="mt-1 block text-[8px] font-bold text-amber-600 leading-tight uppercase bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                      🇦🇷 {feriados[key].motivo}
                    </span>
                  )}
                </div>
                {!isPast && (
                  <button
                    onClick={() => openModalForDate(date)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-surface-300 opacity-0 group-hover:opacity-100 hover:bg-primary-50 hover:text-primary-600 transition-all"
                    title={`Planificar para ${DIAS_FULL[i]}`}
                  >
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                )}
              </div>

              {/* Classes for this day */}
              <div className="flex flex-col gap-1.5 flex-1">
                {items.length === 0 && (
                  <p className="text-[10px] text-surface-300 italic mt-auto">Sin clases</p>
                )}
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "group/item relative rounded-xl pl-2.5 pr-10 py-2 transition-all cursor-default",
                      "bg-gradient-to-r from-primary-50 to-white border border-primary-100",
                      "hover:shadow-sm hover:border-primary-200"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Clock size={10} className="text-surface-400 shrink-0" />
                      <span className="text-[10px] font-bold text-surface-700">{item.hora.substring(0, 5)}</span>
                    </div>
                    <p className="text-xs font-bold text-surface-900 leading-tight truncate">
                      {item.alumnos?.nombre} {item.alumnos?.apellido?.charAt(0)}.
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] text-surface-500 truncate">{item.tema_previsto || "Sin tema especificado"}</span>
                    </div>

                    {/* Hover actions (always visible on mobile) */}
                    <div className="absolute top-1 right-1 flex lg:hidden lg:group-hover/item:flex items-center gap-0.5">
                      <Link
                        href={`/clases/nueva?alumnoId=${item.alumno_id}&tema=${encodeURIComponent(item.tema_previsto || "")}&agendaId=${item.id}`}
                        className="rounded-md bg-primary-600 p-1 text-white hover:bg-primary-700 transition-colors"
                        title="Iniciar clase"
                      >
                        <Rocket size={10} />
                      </Link>
                      <button
                        onClick={() => handleEliminar(item.id)}
                        className="rounded-md bg-surface-100 p-1 text-surface-400 hover:bg-danger-50 hover:text-danger-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cerradas Recientemente — Collapsible */}
      <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden">
        <button
          onClick={() => setShowCerradas(!showCerradas)}
          className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-surface-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <History size={16} className="text-surface-400" />
            <span className="text-sm font-bold text-surface-700">Cerradas Recientemente</span>
            <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-bold text-surface-500">{clasesCerradas.length}</span>
          </div>
          <ChevronRight size={16} className={cn("text-surface-400 transition-transform", showCerradas && "rotate-90")} />
        </button>

        {showCerradas && (
          <div className="border-t border-surface-100 divide-y divide-surface-100">
            {clasesCerradas.length === 0 ? (
              <p className="p-6 text-center text-sm text-surface-500">Aún no completaste ninguna clase.</p>
            ) : (
              clasesCerradas.map((clase) => (
                <div key={clase.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-50/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-surface-900 truncate">
                        {clase.alumno?.nombre} {clase.alumno?.apellido}
                      </p>
                      <p className="text-[10px] text-surface-500 truncate">{clase.tema}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-bold text-surface-400">
                      {new Date(clase.fecha).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                    </span>
                    {!clase.pago ? (
                      <span className="text-[10px] font-bold text-surface-400 bg-surface-100 px-2 py-0.5 rounded-full">Sin registro</span>
                    ) : clase.pago.estado === "pagado" ? (
                      <span className="text-[10px] font-bold text-success-700 bg-success-50 px-2 py-0.5 rounded-full">Pagado</span>
                    ) : (
                      <span className="text-[10px] font-bold text-warning-700 bg-warning-50 px-2 py-0.5 rounded-full">Pendiente</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <PlanificarModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        alumnos={alumnos}
        tarifaActual={tarifaActual}
        prefillDate={prefillDate}
        feriados={feriados}
      />
    </div>
  );
}
