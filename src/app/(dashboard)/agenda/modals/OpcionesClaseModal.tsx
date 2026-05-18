"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Sparkles, Rocket, Clock, Zap, CheckCircle2 } from "lucide-react";
import type { AgendaItem } from "@/lib/types/database";
import { cerrarClaseExpress } from "../actions";

export default function OpcionesClaseModal({
  item,
  onClose,
  onEdit,
}: {
  item: AgendaItem;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [isClosingExpress, setIsClosingExpress] = useState(false);

  const handleExpressClose = async () => {
    try {
      setIsClosingExpress(true);
      await cerrarClaseExpress(item.id);
      onClose();
    } catch (e) {
      console.error(e);
      setIsClosingExpress(false);
    }
  };

  const canFinalize = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA");

    if (item.fecha < todayStr) return true;
    if (item.fecha === todayStr) {
      const [h, m] = item.hora.split(":").map(Number);
      const startMinutes = h * 60 + m;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      return currentMinutes >= startMinutes - 15;
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
            <>
              <button
                onClick={handleExpressClose}
                disabled={isClosingExpress}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-surface-900 px-6 py-4 text-sm font-black text-white shadow-lg hover:bg-surface-800 transition-all active:scale-95 hover:translate-y-[-2px] disabled:opacity-50"
              >
                {isClosingExpress ? (
                  <>
                    <CheckCircle2 size={18} className="animate-pulse text-success-400" />
                    Cerrando...
                  </>
                ) : (
                  <>
                    <Zap size={18} className="text-warning-400" strokeWidth={2.5} />
                    Cierre Rápido
                  </>
                )}
              </button>
              <Link
                href={`/clases/nueva?alumnoId=${item.alumno_id}&tema=${encodeURIComponent(item.tema_previsto || "")}&agendaId=${item.id}`}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary-50 px-6 py-4 text-sm font-bold text-primary-700 hover:bg-primary-100 transition-all active:scale-95 border border-primary-200"
              >
                <Sparkles size={18} strokeWidth={2.5} />
                Cierre con Tiza
              </Link>
            </>
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
