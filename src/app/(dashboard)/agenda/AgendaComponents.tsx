"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { type AgendaItem } from "@/lib/types/database";
import { Plus } from "lucide-react";
import {
  useDraggable,
  useDroppable,
  type Modifier,
} from "@dnd-kit/core";
import { formatDateKey } from "@/lib/utils/fechas";

// 20px = 15 minutos (80px = 1h)
export const snapToGridModifier: Modifier = ({ transform }) => ({
  ...transform,
  y: Math.round(transform.y / 20) * 20,
});

export function ClaseCard({
  item,
  style,
  isGhost,
  isDraggingActive,
  listeners,
  attributes,
  setNodeRef,
  onClick,
  heightDelta = 0
}: {
  item: AgendaItem;
  style?: React.CSSProperties;
  isGhost?: boolean;
  isDraggingActive?: boolean;
  listeners?: unknown;
  attributes?: unknown;
  setNodeRef?: (node: HTMLElement | null) => void;
  onClick?: () => void;
  heightDelta?: number;
}) {
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
      {...(listeners as Record<string, unknown>)}
      {...(attributes as Record<string, unknown>)}
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

export function DraggableClase({ item, onSelect, heightDelta = 0 }: { item: AgendaItem; onSelect: (item: AgendaItem) => void; heightDelta?: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: item,
    disabled: heightDelta !== 0
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
        onClick={() => onSelect(item)}
        heightDelta={heightDelta}
      />
    </>
  );
}

export function DroppableColumna({ date, isToday, isPast, children, onAddClass }: {
  date: Date;
  isToday: boolean;
  isPast: boolean;
  children: React.ReactNode;
  onAddClass: (date: Date) => void;
}) {
  const dateKey = formatDateKey(date);
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
    data: { date: dateKey },
  });

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
      {Array.from({ length: 15 }).map((_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-surface-100/30 h-0 pointer-events-none"
          style={{ top: i * 80 }}
        />
      ))}

      {isToday && nowTop !== null && (
        <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: nowTop }}>
          <div className="w-2 h-2 rounded-full bg-danger-500 -ml-1" />
          <div className="flex-1 h-px bg-danger-500" />
        </div>
      )}

      <div className="relative flex-1">
        {children}
      </div>

      {!isPast && (
        <button
          onClick={() => onAddClass(date)}
          className="absolute inset-0 opacity-0 group-hover/col:opacity-100 flex items-center justify-center hover:bg-primary-50/50 transition-all z-0"
          title="Agendar en este día"
        >
          <Plus className="text-primary-600/20" size={48} />
        </button>
      )}
    </div>
  );
}
