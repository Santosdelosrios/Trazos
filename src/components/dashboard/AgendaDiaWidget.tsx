"use client";

import { memo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { AgendaItem } from "@/lib/types/database";
import { Coffee, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DndContext,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  type DragEndEvent,
  type DragMoveEvent,
  useDraggable,
  useDroppable,
  type Modifier,
} from "@dnd-kit/core";
import dynamic from "next/dynamic";
import { formatDateKey as formatDateStr, parseDateKey as parseDateStr } from "@/lib/utils/fechas";
import { useOptimisticAgenda } from "@/lib/hooks/useOptimisticAgenda";

const OpcionesClaseModal = dynamic(() => import("@/app/(dashboard)/agenda/modals/OpcionesClaseModal"), { ssr: false });
const EditarClaseModal = dynamic(() => import("@/app/(dashboard)/agenda/modals/EditarClaseModal"), { ssr: false });
const PrepararClaseModal = dynamic(() => import("@/app/(dashboard)/agenda/modals/PrepararClaseModal"), { ssr: false });

interface AgendaDiaWidgetProps {
  items: AgendaItem[];
  alumnos: { id: string; nombre: string; apellido: string }[];
  esPremium?: boolean;
}

const snapToGridModifier: Modifier = ({ transform }) => {
  return {
    ...transform,
    y: Math.round(transform.y / 20) * 20, // 20px = 15 mins
  };
};

function ClaseCard({
  item, style, isGhost, isDraggingActive, listeners, attributes, setNodeRef, onClick, heightDelta = 0
}: any) {
  const [h, m] = item.hora.split(":").map(Number);
  const startMinutes = h * 60 + m;
  const pxPerMinute = 80 / 60;
  const top = (startMinutes - 8 * 60) * pxPerMinute;
  const durationMinutes = (item.duracion_estimada || 1) * 60;
  const height = Math.max(20, (durationMinutes * pxPerMinute) + heightDelta);

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
      onClick={() => {
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
        "group/item rounded-xl pl-2.5 pr-1 py-1.5 border shadow-sm transition-shadow",
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
        {!isGhost && !isDraggingActive && (
          <ResizeHandle id={item.id} item={item} />
        )}
      </div>
    </div>
  );
}

function ResizeHandle({ id, item }: { id: string; item: AgendaItem }) {
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

interface DraggableClaseProps {
  item: AgendaItem;
  onSelect: (item: AgendaItem) => void;
  heightDelta?: number;
}

const DraggableClase = memo(function DraggableClase({
  item,
  onSelect,
  heightDelta = 0,
}: DraggableClaseProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: item,
    disabled: heightDelta !== 0,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <>
      {isDragging && <ClaseCard item={item} isGhost={true} />}
      <ClaseCard
        item={item}
        style={style}
        isDraggingActive={isDragging}
        listeners={listeners}
        attributes={attributes}
        setNodeRef={setNodeRef}
        onClick={() => onSelect(item)}
        heightDelta={heightDelta}
      />
    </>
  );
});

function DroppableColumna({ dateKey, isToday, children }: { dateKey: string; isToday: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
    data: { date: dateKey },
  });

  const [nowTop, setNowTop] = useState<number | null>(null);

  useEffect(() => {
    if (!isToday) {
      setNowTop(null);
      return;
    }
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
        "relative flex flex-col min-h-[1120px] transition-colors border-r border-surface-100 last:border-r-0 flex-1 min-w-0",
        "bg-primary-50/10",
        isOver && "bg-primary-50/50"
      )}
    >
      {Array.from({ length: 15 }).map((_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-surface-100/30 h-0 pointer-events-none"
          style={{ top: i * 80 }}
        />
      ))}

      {nowTop !== null && (
        <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: nowTop }}>
          <div className="w-2 h-2 rounded-full bg-danger-500 -ml-1" />
          <div className="flex-1 h-px bg-danger-500" />
        </div>
      )}
      <div className="relative flex-1">{children}</div>
    </div>
  );
}

export default function AgendaDiaWidget({ items, alumnos, esPremium = false }: AgendaDiaWidgetProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState("");
  const [selectionItem, setSelectionItem] = useState<AgendaItem | null>(null);
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
  const [preparingItem, setPreparingItem] = useState<AgendaItem | null>(null);
  
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizingDeltaY, setResizingDeltaY] = useState(0);

  const { optimisticAgenda, reprogramarClase, redimensionarClase } = useOptimisticAgenda(items);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  useEffect(() => {
    setSelectedDateStr(formatDateStr(new Date()));
    setMounted(true);
  }, []);

  const prevDay = () => {
    if (!selectedDateStr) return;
    const date = parseDateStr(selectedDateStr);
    date.setDate(date.getDate() - 1);
    setSelectedDateStr(formatDateStr(date));
  };

  const nextDay = () => {
    if (!selectedDateStr) return;
    const date = parseDateStr(selectedDateStr);
    date.setDate(date.getDate() + 1);
    setSelectedDateStr(formatDateStr(date));
  };

  const goToday = () => {
    setSelectedDateStr(formatDateStr(new Date()));
  };

  const handleDragStart = (event: { active: { id: string | number; data: { current?: unknown } } }) => {
    const { active } = event;
    if (active.id.toString().startsWith("resize-")) {
      setResizingId((active.data.current as { item: AgendaItem }).item.id);
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (resizingId) {
      setResizingDeltaY(event.delta.y);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;

    if (resizingId) {
      const item = (active.data.current as { item?: AgendaItem })?.item;
      if (item) {
        const snappedDeltaY = Math.round(resizingDeltaY / 20) * 20;
        const extraMinutes = (snappedDeltaY * 60) / 80;
        const currentDurationMinutes = (item.duracion_estimada || 1) * 60;
        const newDurationHours = Math.max(0.25, (currentDurationMinutes + extraMinutes) / 60);

        setResizingId(null);
        setResizingDeltaY(0);
        redimensionarClase(item.id, newDurationHours);
      } else {
        setResizingId(null);
        setResizingDeltaY(0);
      }
      return;
    }

    if (over) {
      const item = active.data.current as AgendaItem;
      const [h, m] = item.hora.split(":").map(Number);
      const originalMinutes = h * 60 + m;
      const pxPerMinute = 80 / 60;
      const deltaMinutes = Math.round(delta.y / pxPerMinute / 15) * 15;

      let newMinutes = originalMinutes + deltaMinutes;
      newMinutes = Math.max(8 * 60, Math.min(22 * 60, newMinutes));

      const newH = Math.floor(newMinutes / 60);
      const newM = newMinutes % 60;
      const newHora = `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;

      if (newHora === item.hora) return;

      reprogramarClase(item.id, selectedDateStr, newHora);
    }
  };

  if (!mounted) return <div className="h-96 rounded-2xl bg-surface-100 animate-pulse" />;

  const isToday = selectedDateStr === formatDateStr(new Date());
  const todaysItems = optimisticAgenda.filter(i => i.fecha === selectedDateStr);
  const displayDateText = selectedDateStr ? parseDateStr(selectedDateStr).toLocaleDateString("es-AR", { weekday: 'long', day: 'numeric', month: 'long' }) : "";

  return (
    <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden flex flex-col h-full">
      <div className="border-b border-surface-100 bg-surface-50/50 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
            <CalendarIcon size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-surface-900 leading-tight">
              {isToday ? "La Agenda de Hoy" : "Agenda Diaria"}
            </h2>
            <p className="text-xs text-surface-500 font-medium capitalize">
              {displayDateText}
            </p>
          </div>
        </div>

        {/* Navegador de Días */}
        <div className="flex items-center gap-2">
          {!isToday && (
            <button
              onClick={goToday}
              className="rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-100 transition-colors shadow-2xs"
            >
              Hoy
            </button>
          )}
          <div className="flex items-center rounded-xl border border-surface-200 bg-white shadow-2xs p-0.5">
            <button
              onClick={prevDay}
              className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 hover:text-surface-900 transition-colors"
              title="Día anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="h-4 w-px bg-surface-200 my-auto mx-0.5" />
            <button
              onClick={nextDay}
              className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 hover:text-surface-900 transition-colors"
              title="Día siguiente"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {todaysItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-100 text-surface-400">
            <Coffee size={32} />
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-2">¡Día libre, a recargar energías!</h3>
          <p className="text-sm text-surface-500 max-w-xs">
            {isToday 
              ? "No tenés clases programadas para hoy. Aprovechá para descansar o planificar tus próximas semanas."
              : "No hay clases agendadas para este día."
            }
          </p>
        </div>
      ) : (
        <div className="flex-1 relative overflow-y-auto overflow-x-hidden max-h-[600px] bg-white custom-scrollbar">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            modifiers={[snapToGridModifier]}
          >
            <div className="flex">
              {/* Eje de Horas */}
              <div className="w-16 flex-none bg-surface-50/30 border-r border-surface-100 relative">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="h-20 border-b border-surface-100/50 relative">
                    <span className="absolute -top-2.5 right-2 text-[10px] font-bold text-surface-400">
                      {String(i + 8).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* Columna Principal */}
              <DroppableColumna dateKey={selectedDateStr} isToday={isToday}>
                {todaysItems.map((item) => (
                  <DraggableClase
                    key={item.id}
                    item={item}
                    onSelect={setSelectionItem}
                    heightDelta={resizingId === item.id ? resizingDeltaY : 0}
                  />
                ))}
              </DroppableColumna>
            </div>
          </DndContext>
        </div>
      )}

      {selectionItem && (
        <OpcionesClaseModal
          item={selectionItem}
          onClose={() => setSelectionItem(null)}
          onEdit={() => {
            setEditingItem(selectionItem);
            setSelectionItem(null);
          }}
          onPreparar={() => {
            setPreparingItem(selectionItem);
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

      {preparingItem && (
        <PrepararClaseModal
          item={preparingItem}
          esPremium={esPremium}
          onClose={() => setPreparingItem(null)}
        />
      )}
    </div>
  );
}
