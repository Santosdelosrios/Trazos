"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { type AgendaItem } from "@/lib/types/database";
import { planificarClase, eliminarPlanificacion, actualizarHorarioClase } from "./actions";
import {
  CalendarDays, Sparkles, RefreshCw, X, Plus,
  ChevronLeft, ChevronRight, Rocket, Trash2, Clock, History,
  CalendarSync, Copy, Check, Crown
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  type DragEndEvent,
  useDraggable,
  useDroppable,
  type Modifier,
} from "@dnd-kit/core";

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

// --- Modifiers ---
const snapToGridModifier: Modifier = ({ transform }) => {
  return {
    ...transform,
    y: Math.round(transform.y / 20) * 20, // 20px = 15 minutos (80px = 1h)
  };
};

// --- Draggable & Droppable Components ---

function ClaseCard({
  item,
  style,
  isGhost,
  isDraggingActive,
  listeners,
  attributes,
  setNodeRef,
  onClick,
  heightDelta = 0
}: any) {
  const [h, m] = item.hora.split(":").map(Number);
  const startMinutes = h * 60 + m;
  const pxPerMinute = 80 / 60;
  const top = (startMinutes - 8 * 60) * pxPerMinute;
  const durationMinutes = (item.duracion_estimada || 1) * 60;
  const height = Math.max(20, (durationMinutes * pxPerMinute) + heightDelta);

  // Calcular hora de fin dinámica
  const currentDurationMinutes = height / pxPerMinute;
  const totalEndMinutes = startMinutes + currentDurationMinutes;
  const displayEndH = Math.floor(totalEndMinutes / 60);
  const displayEndM = Math.round(totalEndMinutes % 60);
  const finalEndH = displayEndM >= 60 ? displayEndH + 1 : displayEndH;
  const finalEndM = displayEndM >= 60 ? 0 : displayEndM;
  const endHora = `${String(finalEndH).padStart(2, "0")}:${String(finalEndM).padStart(2, "0")}`;

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        // Evitar que el clic se dispare si estamos redimensionando
        if (heightDelta !== 0) return;
        onClick?.();
      }}
      style={{
        ...style,
        top: top,
        height: height,
        position: "absolute",
        zIndex: isDraggingActive || heightDelta !== 0 ? 50 : isGhost ? 5 : 10,
        left: "4px",
        right: "4px",
        touchAction: "none",
      }}
      className={cn(
        "group/item rounded-xl pl-2.5 pr-1 py-1.5 border shadow-sm transition-shadow w-full",
        isGhost ? "opacity-30 grayscale pointer-events-none border-dashed" : "opacity-100",
        (isDraggingActive || heightDelta !== 0) ? "shadow-2xl scale-[1.02] border-primary-300 ring-4 ring-primary-500/10 cursor-grabbing" : "border-primary-100",
        "bg-white border-l-4 border-l-primary-500",
        "hover:shadow-md hover:border-primary-200"
      )}
      {...listeners}
      {...attributes}
    >
      <div className="flex flex-col h-full overflow-hidden relative">
        <p className="text-[10px] font-bold text-primary-700 leading-none mb-1">
          {item.hora.substring(0, 5)} - {endHora}
        </p>
        <p className="text-xs font-black text-surface-900 leading-tight truncate">
          {item.alumnos?.nombre} {item.alumnos?.apellido?.charAt(0)}.
        </p>
        {height > 35 && (
          <p className="text-[9px] text-surface-500 truncate mt-0.5 leading-none">
            {item.tema_previsto || "Sin tema"}
          </p>
        )}

        {/* Resize Handle */}
        {!isGhost && !isDraggingActive && (
          <ResizeHandle id={item.id} item={item} />
        )}
      </div>
    </div>
  );
}

function ResizeHandle({ id, item }: { id: string; item: any }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `resize-${id}`,
    data: { type: 'resize', item },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="absolute -bottom-1.5 -left-2.5 -right-1 h-4 cursor-ns-resize flex items-center justify-center group-hover:bg-primary-500/5 transition-colors z-[60]"
    >
      <div className="w-8 h-1 rounded-full bg-surface-200 group-hover/item:bg-primary-300 transition-colors" />
    </div>
  );
}

function DraggableClase({ item, onClick, heightDelta = 0 }: { item: AgendaItem; onClick: () => void; heightDelta?: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: item,
    disabled: heightDelta !== 0 // Desactivar drag si estamos redimensionando
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <>
      {isDragging && (
        <ClaseCard
          item={item}
          isGhost={true}
        />
      )}
      <ClaseCard
        item={item}
        style={style}
        isDraggingActive={isDragging}
        listeners={listeners}
        attributes={attributes}
        setNodeRef={setNodeRef}
        onClick={onClick}
        heightDelta={heightDelta}
      />
    </>
  );
}


function DroppableColumna({ date, isToday, isPast, children }: {
  date: Date;
  isToday: boolean;
  isPast: boolean;
  children: React.ReactNode
}) {
  const dateKey = formatDateKey(date);
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
    data: { date: dateKey },
  });

  // Now indicator line
  const [nowTop, setNowTop] = useState<number | null>(null);

  useEffect(() => {
    if (!isToday) return;
    const updateNow = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      if (h < 8 || h >= 23) {
        setNowTop(null);
        return;
      }
      const pxPerMinute = 80 / 60;
      setNowTop((h * 60 + m - 8 * 60) * pxPerMinute);
    };
    updateNow();
    const interval = setInterval(updateNow, 60000);
    return () => clearInterval(interval);
  }, [isToday]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex flex-col min-h-[1120px] transition-colors border-r border-surface-100 last:border-r-0 group/col",
        isToday ? "bg-primary-50/10" : isPast ? "bg-surface-50/20" : "bg-white",
        isOver && "bg-primary-50/50"
      )}
    >
      {/* Grid lines */}
      {Array.from({ length: 15 }).map((_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-surface-100/30 h-0 pointer-events-none"
          style={{ top: i * 80 }}
        />
      ))}

      {/* Now indicator */}
      {isToday && nowTop !== null && (
        <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: nowTop }}>
          <div className="w-2 h-2 rounded-full bg-danger-500 -ml-1" />
          <div className="flex-1 h-px bg-danger-500" />
        </div>
      )}

      <div className="relative flex-1">
        {children}
      </div>
    </div>
  );
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

// --- Selection Modal ---
function OpcionesClaseModal({
  item,
  onClose,
  onEdit,
}: {
  item: AgendaItem;
  onClose: () => void;
  onEdit: () => void;
}) {
  const canFinalize = useMemo(() => {
    const now = new Date();
    // Usamos en-CA para obtener YYYY-MM-DD de forma confiable
    const todayStr = now.toLocaleDateString("en-CA");
    
    if (item.fecha < todayStr) return true;
    if (item.fecha === todayStr) {
      const [h, m] = item.hora.split(":").map(Number);
      const startMinutes = h * 60 + m;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      // Permitimos finalizar si faltan 15 min para empezar o si ya empezó/pasó
      return currentMinutes >= (startMinutes - 15);
    }
    return false;
  }, [item]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-[280px] rounded-[2.5rem] bg-white p-8 shadow-2xl animate-scale-up border border-surface-100">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <Sparkles size={28} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-surface-400 mb-1">Clase con</p>
          <h3 className="text-xl font-black text-surface-900 leading-tight">
            {item.alumnos?.nombre} {item.alumnos?.apellido}
          </h3>
        </div>
        
        <div className="space-y-3">
          {canFinalize ? (
            <Link
              href={`/clases/nueva?alumnoId=${item.alumno_id}&tema=${encodeURIComponent(item.tema_previsto || "")}&agendaId=${item.id}`}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition-all active:scale-95 hover:translate-y-[-2px]"
            >
              <Rocket size={18} strokeWidth={2.5} />
              Finalizar clase
            </Link>
          ) : (
            <div className="group relative">
              <button
                disabled
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-surface-100 px-6 py-4 text-sm font-black text-surface-400 cursor-not-allowed opacity-60"
              >
                <Rocket size={18} strokeWidth={2.5} />
                Finalizar clase
              </button>
              <p className="mt-2 text-center text-[10px] font-bold text-amber-600 animate-pulse">
                Disponible cuando empiece la clase
              </p>
            </div>
          )}
          
          <button
            onClick={onEdit}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-surface-50 px-6 py-4 text-sm font-bold text-surface-700 hover:bg-surface-100 transition-all active:scale-95 border border-surface-100"
          >
            <Clock size={18} />
            Editar clase
          </button>
        </div>
        
        <button 
          onClick={onClose}
          className="mt-8 w-full text-[10px] font-black uppercase tracking-widest text-surface-400 hover:text-surface-600 transition-colors"
        >
          Cerrar
        </button>
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

  const handleDragStart = (event: any) => {
    const { active } = event;
    if (active.id.toString().startsWith("resize-")) {
      setResizingId(active.data.current.item.id);
      return;
    }
    setActiveItem(active.data.current);
  };

  const handleDragMove = (event: any) => {
    if (resizingId) {
      const { delta } = event;
      setResizingDeltaY(delta.y);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, delta } = event;

    if (resizingId) {
      const item = (active.data.current as any).item;
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

      try {
        const { actualizarHorarioClase } = await import("./actions");
        await actualizarHorarioClase(item.id, newDate, newHora);
      } catch (err) {
        console.error(err);
      }
    }
  };

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

      {/* Weekly calendar grid */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        modifiers={[snapToGridModifier]}
      >
        <div className="rounded-3xl border border-surface-200 bg-white shadow-xl overflow-hidden">
          <div className="flex border-b border-surface-100 bg-surface-50/50">
            {/* Hour axis header spacer */}
            <div className="w-16 border-r border-surface-100" />
            <div className="flex-1 grid grid-cols-7">
              {weekDays.map((date, i) => {
                const isToday = isSameDay(date, today);
                return (
                  <div key={i} className={cn(
                    "px-2 py-4 text-center border-r border-surface-100 last:border-r-0",
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

          <div className="flex relative overflow-y-auto max-h-[700px]">
            {/* Hour Axis */}
            <div className="w-16 flex-none bg-surface-50/30 border-r border-surface-100 relative">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="h-20 border-b border-surface-100/50 relative">
                  <span className="absolute -top-2.5 right-2 text-[10px] font-bold text-surface-400">
                    {String(i + 8).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Columns Grid */}
            <div className="flex-1 grid grid-cols-7 min-w-[800px]">
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
                  >
                    {items.map((item) => (
                      <DraggableClase key={item.id} item={item} onClick={() => setSelectionItem(item)} />
                    ))}

                    {/* Ghost button to add class */}
                    {!isPast && (
                      <button
                        onClick={() => openModalForDate(date)}
                        className="absolute inset-0 opacity-0 group-hover/col:opacity-100 flex items-center justify-center hover:bg-primary-50/50 transition-all z-0"
                        title="Agendar en este día"
                      >
                        <Plus className="text-primary-600/20" size={48} />
                      </button>
                    )}
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
    </div>
  );
}

// --- Modals Components ---

function EditarClaseModal({
  item, onClose, alumnos,
}: {
  item: AgendaItem;
  onClose: () => void;
  alumnos: any[];
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    alumno_id: item.alumno_id,
    hora: item.hora.substring(0, 5),
    tema_previsto: item.tema_previsto || "",
    tarifa_esperada: item.tarifa_esperada || 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const { actualizarClase } = await import("./actions");
      await actualizarClase(item.id, formData);
      onClose();
    } catch (error: any) {
      setErrorMsg("Error: " + (error.message || "No se pudo actualizar"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Estás segura de que querés eliminar esta clase?")) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const { eliminarPlanificacion } = await import("./actions");
      await eliminarPlanificacion(item.id);
      onClose();
    } catch (error: any) {
      setErrorMsg("Error: " + (error.message || "No se pudo eliminar"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/40 p-4 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-scale-up border border-surface-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-surface-900">Editar Clase</h2>
          <button onClick={onClose} className="rounded-full p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {errorMsg && <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-600 border border-danger-100">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-surface-700 uppercase tracking-wider">Alumno</label>
            <select
              required
              value={formData.alumno_id}
              onChange={(e) => setFormData({ ...formData, alumno_id: e.target.value })}
              className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all"
            >
              <option value="" disabled>Seleccionar alumno...</option>
              {alumnos.map((a: any) => (
                <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-surface-700 uppercase tracking-wider flex items-center gap-1"><Clock size={12} /> Hora</label>
              <input
                type="time" required
                value={formData.hora}
                onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-surface-700 uppercase tracking-wider">Monto ARS</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-surface-400 text-sm">$</span>
                <input
                  type="number" required
                  value={formData.tarifa_esperada}
                  onChange={(e) => setFormData({ ...formData, tarifa_esperada: Number(e.target.value) })}
                  className="w-full rounded-xl border border-surface-200 bg-surface-50 pl-7 pr-3 py-2.5 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-surface-700 uppercase tracking-wider">Temas de la clase</label>
            <input
              type="text" placeholder="Ej: Multiplicación y división"
              value={formData.tema_previsto}
              onChange={(e) => setFormData({ ...formData, tema_previsto: e.target.value })}
              className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-danger-200 bg-danger-50 text-danger-600 hover:bg-danger-100 transition-colors disabled:opacity-40"
              title="Eliminar clase"
            >
              <Trash2 size={18} />
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-surface-900 py-3 text-sm font-bold text-white shadow-md hover:bg-surface-800 transition-all active:scale-95 disabled:opacity-40"
            >
              {isSubmitting ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
