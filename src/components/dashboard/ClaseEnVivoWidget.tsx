"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Rocket, Sparkles, ChevronRight, Zap, CheckCircle2 } from "lucide-react";
import { cerrarClaseExpress } from "@/app/(dashboard)/agenda/actions";

export default function ClaseEnVivoWidget({ proximasClases }: { proximasClases: any[] }) {
  const [claseEnVivo, setClaseEnVivo] = useState<any>(null);
  const [isClosingExpress, setIsClosingExpress] = useState(false);

  const handleExpressClose = async () => {
    try {
      setIsClosingExpress(true);
      await cerrarClaseExpress(claseEnVivo.id);
      setClaseEnVivo(null);
    } catch (e) {
      console.error(e);
      setIsClosingExpress(false);
    }
  };

  useEffect(() => {
    const checkLive = () => {
      const now = new Date();
      // Usamos locale Argentino para asegurar que el string de fecha sea el correcto para el usuario
      // en-CA suele devolver YYYY-MM-DD
      const todayStr = now.toLocaleDateString("en-CA", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const live = proximasClases?.find((clase: any) => {
        if (clase.fecha !== todayStr) return false;
        const [h, m] = clase.hora.split(":").map(Number);
        const startMinutes = h * 60 + m;
        const endMinutes = startMinutes + (clase.duracion_estimada || 1) * 60;
        // Margen de 15 minutos
        return currentMinutes >= (startMinutes - 15) && currentMinutes <= (endMinutes + 15);
      });
      setClaseEnVivo(live);
    };

    checkLive();
    const interval = setInterval(checkLive, 30000); // Check cada 30 segundos
    return () => clearInterval(interval);
  }, [proximasClases]);

  if (!claseEnVivo) return null;

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-primary-500 bg-white p-6 shadow-xl animate-bounce-subtle">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary-100 opacity-20" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shrink-0">
            <Rocket className="h-8 w-8 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary-700">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-600 animate-ping" />
                En vivo ahora
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-black text-surface-900 leading-tight">
              Estás en clase con {claseEnVivo.alumnos?.nombre}
            </h2>
            <p className="mt-1 text-sm font-medium text-surface-500">
              Tema previsto: <span className="text-surface-700">{claseEnVivo.tema_previsto || "Pendiente de definir"}</span>
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-2 shrink-0 w-full md:w-auto">
          <button
            onClick={handleExpressClose}
            disabled={isClosingExpress}
            className="flex items-center justify-center gap-2 rounded-2xl bg-surface-900 px-6 py-3.5 text-sm font-black text-white shadow-lg hover:bg-surface-800 transition-all active:scale-95 disabled:opacity-50 w-full"
          >
            {isClosingExpress ? (
              <>
                <CheckCircle2 size={18} className="animate-pulse text-success-400" />
                Cerrando...
              </>
            ) : (
              <>
                <Zap size={18} className="text-warning-400" />
                Cierre Rápido
              </>
            )}
          </button>
          <Link
            href={`/clases/nueva?alumnoId=${claseEnVivo.alumno_id}&tema=${encodeURIComponent(claseEnVivo.tema_previsto || "")}&agendaId=${claseEnVivo.id}`}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary-50 border border-primary-200 px-6 py-3.5 text-sm font-bold text-primary-700 hover:bg-primary-100 transition-all active:scale-95 w-full"
          >
            <Sparkles size={18} />
            Cierre Pedagógico
          </Link>
        </div>
      </div>
    </div>
  );
}
