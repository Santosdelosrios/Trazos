"use client";

import { useState, useMemo, useEffect, useCallback, useOptimistic, startTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { type AgendaItem } from "@/lib/types/database";
import {
  CalendarDays, Plus,
  ChevronLeft, ChevronRight, History,
  CalendarSync, Copy, Check, Crown, AlertCircle
} from "lucide-react";
import {
  DndContext,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { DraggableClase, DroppableColumna, snapToGridModifier } from "./AgendaComponents";
import dynamic from "next/dynamic";
import { actualizarHorarioClase } from "./actions";
import { getFeriados, formatFeriadoDate, type Feriado } from "@/lib/utils/feriados";

import type { ClaseCerrada } from "./page";

interface AgendaClientProps {
  initialAgenda: AgendaItem[];
  alumnos: { id: string; nombre: string; apellido: string }[];
  tarifaActual: number | null;
  clasesCerradas: ClaseCerrada[];
  plan?: "free" | "premium";
  calendarToken?: string | null;
}
import {
  DIAS_SEMANA as DIAS,
  getMonday,
  getWeekDays,
  isSameDay,
  formatDateKey,
  formatFechaDiaMes,
} from "@/lib/utils/fechas";

const PlanificarModal = dynamic(() => import("./modals/PlanificarModal"), { ssr: false });
const OpcionesClaseModal = dynamic(() => import("./modals/OpcionesClaseModal"), { ssr: false });
const EditarClaseModal = dynamic(() => import("./modals/EditarClaseModal"), { ssr: false });

// --- Main Component ---
export default function AgendaClient({ initialAgenda, alumnos, tarifaActual, clasesCerradas, plan = "free", calendarToken }: AgendaClientProps) {
  // `today` y `currentMonday` se inicializan con una fecha epoch determinista
  // para que SSR y primer render del cliente coincidan; el `useEffect`
  // posterior los reemplaza por la fecha real una vez montado.
  const [mounted, setMounted] = useState(false);
  const [today, setToday] = useState<Date>(() => new Date(0));
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date(0)));
  const [modalOpen, setModalOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [showCerradas, setShowCerradas] = useState(false);
  const [calendarCopied, setCalendarCopied] = useState(false);
  const [feriados, setFeriados] = useState<Record<string, Feriado>>({});
  const calendarUrl = mounted && calendarToken && typeof window !== "undefined"
    ? `${window.location.origin}/api/calendar/${calendarToken}`
    : "";
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
  const [selectionItem, setSelectionItem] = useState<AgendaItem | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizingDeltaY, setResizingDeltaY] = useState(0);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  const [activeItem, setActiveItem] = useState<AgendaItem | null>(null);

  // Optimistic UI para reprogramar clases (drag & drop).
  // El rollback es automático: si la Server Action lanza, la transición termina
  // sin revalidar y el estado vuelve a `initialAgenda` (posición original).
  const [optimisticAgenda, moveClaseOptimista] = useOptimistic(
    initialAgenda,
    (state, move: { id: string; fecha: string; hora: string }) =>
      state.map((clase) =>
        clase.id === move.id
          ? { ...clase, fecha: move.fecha, hora: move.hora }
          : clase
      )
  );
  const [dragError, setDragError] = useState<string | null>(null);

  const handleDragStart = (event: { active: { id: string | number; data: { current?: unknown } } }) => {
    const { active } = event;
    if (active.id.toString().startsWith("resize-")) {
      setResizingId((active.data.current as { item: AgendaItem }).item.id);
      return;
    }
    setActiveItem(active.data.current as AgendaItem);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (resizingId) {
      const { delta } = event;
      setResizingDeltaY(delta.y);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, delta } = event;

    if (resizingId) {
      const item = (active.data.current as { item?: AgendaItem })?.item;
      if (item) {
        // 20px = 15 min. Snapping manual aquí.
        const snappedDeltaY = Math.round(resizingDeltaY / 20) * 20;
        const extraMinutes = (snappedDeltaY * 60) / 80;
        const currentDurationMinutes = (item.duracion_estimada || 1) * 60;
        const newDurationHours = Math.max(0.25, (currentDurationMinutes + extraMinutes) / 60);

        try {
          const { actualizarDuracionClase } = await import("./actions");
          await actualizarDuracionClase(item.id, newDurationHours);
        } catch (e) {
          console.error(e);
        }
      }
      setResizingId(null);
      setResizingDeltaY(0);
      return;
    }

    setActiveItem(null);

    if (over) {
      const item = active.data.current as AgendaItem;
      const newDate = over.id as string;

      const [h, m] = item.hora.split(":").map(Number);
      const originalMinutes = h * 60 + m;
      const pxPerMinute = 80 / 60;
      const deltaMinutes = Math.round(delta.y / pxPerMinute / 15) * 15;

      let newMinutes = originalMinutes + deltaMinutes;
      newMinutes = Math.max(8 * 60, Math.min(22 * 60, newMinutes));

      const newH = Math.floor(newMinutes / 60);
      const newM = newMinutes % 60;
      const newHora = `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;

      if (newDate === item.fecha && newHora === item.hora) return;

      startTransition(async () => {
        // 1. Reposicionar al instante (no bloqueante).
        moveClaseOptimista({ id: item.id, fecha: newDate, hora: newHora });
        // 2. Persistir en segundo plano; si falla, el estado optimista se
        //    descarta solo (rollback) al terminar la transición sin revalidar.
        try {
          await actualizarHorarioClase(item.id, newDate, newHora);
        } catch (err) {
          console.error(err);
          setDragError("No se pudo reprogramar la clase. Volvé a intentarlo.");
        }
      });
    }
  };

  useEffect(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(t);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentMonday(getMonday(t));
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  useEffect(() => {
    if (!dragError) return;
    const t = setTimeout(() => setDragError(null), 4000);
    return () => clearTimeout(t);
  }, [dragError]);

  const weekDays = useMemo(() => getWeekDays(currentMonday), [currentMonday]);

  const pendingItems = useMemo(
    () => optimisticAgenda.filter((i) => i.estado === "pendiente"),
    [optimisticAgenda]
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

  const prevWeek = useCallback(() => {
    setCurrentMonday(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const nextWeek = useCallback(() => {
    setCurrentMonday(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  const goToday = useCallback(() => setCurrentMonday(getMonday(today)), [today]);

  const openModalForDate = useCallback((date: Date) => {
    setPrefillDate(formatDateKey(date));
    setModalOpen(true);
  }, []);

  const openModal = useCallback(() => {
    setPrefillDate(undefined);
    setModalOpen(true);
  }, []);

  const handleCopyCalendar = useCallback(() => {
    if (calendarUrl) {
      navigator.clipboard.writeText(calendarUrl);
      setCalendarCopied(true);
      setTimeout(() => setCalendarCopied(false), 2000);
    }
  }, [calendarUrl]);

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

      {/* Weekly calendar grid */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        modifiers={[snapToGridModifier]}
      >
        <div className="rounded-3xl border border-surface-200 bg-white shadow-xl overflow-hidden">
          <div className="flex border-b border-surface-100 bg-surface-50/50 md:min-w-[800px]">
            {/* Hour axis header spacer */}
            <div className="w-10 md:w-16 border-r border-surface-100 flex-none" />
            <div className="flex-1 grid grid-cols-7">
              {weekDays.map((date, i) => {
                const isToday = isSameDay(date, today);
                return (
                  <div key={i} className={cn(
                    "px-1 py-4 text-center border-r border-surface-100 last:border-r-0 sm:px-2",
                    isToday && "bg-primary-50/50"
                  )}>
                    <p className={cn(
                      "text-[10px] font-bold uppercase tracking-widest mb-1",
                      isToday ? "text-primary-600" : "text-surface-400"
                    )}>
                      {DIAS[i]}
                    </p>
                    <p className={cn(
                      "text-xl font-black",
                      isToday ? "text-primary-700" : "text-surface-900"
                    )}>
                      {date.getDate()}
                    </p>
                    {feriados[formatDateKey(date)] && (
                      <span className="mt-1 inline-block text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase truncate max-w-full">
                        {feriados[formatDateKey(date)].motivo}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex relative overflow-y-auto overflow-x-auto max-h-[700px] custom-scrollbar">
            {/* Hour Axis */}
            <div className="w-10 md:w-16 flex-none bg-surface-50/30 border-r border-surface-100 sticky left-0 z-10">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="h-20 border-b border-surface-100/50 relative">
                  <span className="absolute -top-2.5 right-2 text-[10px] font-bold text-surface-400">
                    {String(i + 8).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Columns Grid */}
            <div className="flex-1 grid grid-cols-7 md:min-w-[800px]">
              {weekDays.map((date) => {
                const key = formatDateKey(date);
                const items = itemsByDate[key] || [];
                const isToday = isSameDay(date, today);
                const isPast = date < today && !isToday;

                return (
                  <DroppableColumna
                    key={key}
                    date={date}
                    isToday={isToday}
                    isPast={isPast}
                    onAddClass={openModalForDate}
                  >
                    {items.map((item) => (
                      <DraggableClase key={item.id} item={item} onSelect={setSelectionItem} />
                    ))}
                  </DroppableColumna>
                );
              })}
            </div>
          </div>
        </div>
      </DndContext>

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
                      {formatFechaDiaMes(clase.fecha)}
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

      {/* Calendar Sync Section */}
      {plan === "premium" && calendarUrl && (
        <div className="rounded-2xl bg-white border border-surface-200 shadow-sm p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 shrink-0">
              <CalendarSync size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-surface-900">Sincronizar con Google Calendar</h3>
              <p className="text-xs text-surface-500 mt-0.5">Pegá este link en &quot;Otros calendarios &rarr; Desde URL&quot;</p>
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
              <p className="text-xs text-amber-700 mt-0.5">Sincronizá tu agenda y hablá con <b>Tiza</b>, tu asistente virtual.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/perfil" className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-xs font-bold text-white hover:from-amber-500 hover:to-amber-600 transition-colors shadow-sm whitespace-nowrap">
              <Crown size={14} /> Ser Premium
            </Link>
          </div>
        </div>
      )}

      {/* Modals */}
      {modalOpen && (
        <PlanificarModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setPrefillDate(undefined); }}
          alumnos={alumnos}
          tarifaActual={tarifaActual}
          prefillDate={prefillDate}
          feriados={feriados}
        />
      )}

      {selectionItem && (
        <OpcionesClaseModal
          item={selectionItem}
          onClose={() => setSelectionItem(null)}
          onEdit={() => {
            setEditingItem(selectionItem);
            setSelectionItem(null);
          }}
        />
      )}

      {editingItem && (
        <EditarClaseModal
          item={editingItem}
          alumnos={alumnos}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* Toast de error (rollback del drag & drop) */}
      {dragError && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm font-semibold text-danger-500 shadow-xl animate-fade-in-up"
        >
          <AlertCircle size={16} className="shrink-0" />
          {dragError}
        </div>
      )}
    </div>
  );
}

