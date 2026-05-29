"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Rocket, Sparkles, Zap, CheckCircle2,
  Target, Bell, History, NotebookPen, Clock,
} from "lucide-react";
import { cerrarClaseExpress } from "@/app/(dashboard)/agenda/actions";
import {
  actualizarRecordatorioAgenda,
  guardarNotasVivoAgenda,
} from "@/app/(dashboard)/agenda/actions";
import { createClient } from "@/lib/supabase/client";

interface Recordatorio {
  id: string;
  texto: string;
  completado: boolean;
  created_at?: string;
}

interface AgendaItem {
  id: string;
  alumno_id: string;
  alumnos?: { nombre?: string } | { nombre?: string }[];
  fecha: string;
  hora: string;
  duracion_estimada?: number | null;
  tema_previsto?: string | null;
  objetivos?: string[] | null;
  recordatorios?: Recordatorio[] | null;
  notas_vivo?: string | null;
}

interface UltimaClaseConPlan {
  fecha: string;
  plan_proxima: string;
}

export default function ClaseEnVivoWidget({ proximasClases }: { proximasClases: AgendaItem[] }) {
  const [claseEnVivo, setClaseEnVivo] = useState<AgendaItem | null>(null);
  const [isClosingExpress, setIsClosingExpress] = useState(false);
  const [tiempo, setTiempo] = useState<{ corrido: number; total: number } | null>(null);

  // Estado local optimista para recordatorios y notas en vivo.
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [notasVivo, setNotasVivo] = useState("");
  const [savingNotas, setSavingNotas] = useState(false);
  const [ultimaClase, setUltimaClase] = useState<UltimaClaseConPlan | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleExpressClose = async () => {
    if (!claseEnVivo) return;
    try {
      setIsClosingExpress(true);
      // Flush pending notes before closing.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        await guardarNotasVivoAgenda(claseEnVivo.id, notasVivo);
      }
      await cerrarClaseExpress(claseEnVivo.id);
      setClaseEnVivo(null);
    } catch (e) {
      console.error(e);
      setIsClosingExpress(false);
    }
  };

  // Detección de clase en vivo (se chequea cada 30s).
  useEffect(() => {
    const checkLive = () => {
      const now = new Date();
      const todayStr = now.toLocaleDateString("en-CA", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const live = proximasClases?.find((clase) => {
        if (clase.fecha !== todayStr) return false;
        const [h, m] = clase.hora.split(":").map(Number);
        const startMinutes = h * 60 + m;
        const endMinutes = startMinutes + (clase.duracion_estimada || 1) * 60;
        return currentMinutes >= (startMinutes - 15) && currentMinutes <= (endMinutes + 15);
      });
      setClaseEnVivo(live || null);
    };
    checkLive();
    const interval = setInterval(checkLive, 30000);
    return () => clearInterval(interval);
  }, [proximasClases]);

  // Sync local state cuando cambia la clase en vivo.
  useEffect(() => {
    if (!claseEnVivo) {
      setRecordatorios([]);
      setNotasVivo("");
      setUltimaClase(null);
      return;
    }
    setRecordatorios(claseEnVivo.recordatorios ?? []);
    setNotasVivo(claseEnVivo.notas_vivo ?? "");
  }, [claseEnVivo]);

  // Fetch "última clase del mismo alumno con plan_proxima" para mostrar
  // continuidad. Solo cuando hay clase en vivo. Ligero: read-only del
  // cliente, no afecta el server render.
  useEffect(() => {
    if (!claseEnVivo) return;
    const supa = createClient();
    (async () => {
      const { data } = await supa
        .from("clases")
        .select("fecha, plan_proxima, clase_alumnos!inner(alumno_id)")
        .eq("clase_alumnos.alumno_id", claseEnVivo.alumno_id)
        .not("plan_proxima", "is", null)
        .order("fecha", { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = data as { fecha: string; plan_proxima: string } | null;
      if (row && row.plan_proxima && row.plan_proxima.trim() !== "") {
        setUltimaClase({ fecha: row.fecha, plan_proxima: row.plan_proxima });
      } else {
        setUltimaClase(null);
      }
    })().catch(() => {/* silent */});
  }, [claseEnVivo]);

  // Cronómetro discreto: actualiza cada minuto.
  useEffect(() => {
    if (!claseEnVivo) {
      setTiempo(null);
      return;
    }
    const calc = () => {
      const now = new Date();
      const [h, m] = claseEnVivo.hora.split(":").map(Number);
      const startMin = h * 60 + m;
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const totalMin = (claseEnVivo.duracion_estimada || 1) * 60;
      const corrido = Math.max(0, nowMin - startMin);
      setTiempo({ corrido, total: totalMin });
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [claseEnVivo]);

  // Toggle recordatorio: optimistic update + persistir.
  const toggleRecordatorio = async (recId: string) => {
    if (!claseEnVivo) return;
    const prev = recordatorios;
    const next = prev.map((r) =>
      r.id === recId ? { ...r, completado: !r.completado } : r,
    );
    setRecordatorios(next);
    const target = next.find((r) => r.id === recId);
    try {
      await actualizarRecordatorioAgenda(claseEnVivo.id, recId, target?.completado ?? false);
    } catch (e) {
      console.error("Error guardando recordatorio:", e);
      setRecordatorios(prev); // rollback
    }
  };

  // Autosave de notas con debounce de 800ms.
  const onChangeNotas = (texto: string) => {
    setNotasVivo(texto);
    if (!claseEnVivo) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSavingNotas(true);
      try {
        await guardarNotasVivoAgenda(claseEnVivo.id, texto);
      } catch (e) {
        console.error("Error guardando notas:", e);
      } finally {
        setSavingNotas(false);
      }
    }, 800);
  };

  const tiempoTexto = useMemo(() => {
    if (!tiempo || !claseEnVivo) return null;
    const finMin = (() => {
      const [h, m] = claseEnVivo.hora.split(":").map(Number);
      const fin = h * 60 + m + tiempo.total;
      const fh = Math.floor(fin / 60) % 24;
      const fm = fin % 60;
      return `${String(fh).padStart(2, "0")}:${String(fm).padStart(2, "0")}`;
    })();
    return {
      inicio: claseEnVivo.hora,
      fin: finMin,
      pasado: tiempo.corrido > tiempo.total,
      excesoMin: tiempo.corrido - tiempo.total,
    };
  }, [tiempo, claseEnVivo]);

  if (!claseEnVivo) return null;

  const alumno = Array.isArray(claseEnVivo.alumnos)
    ? claseEnVivo.alumnos[0]
    : claseEnVivo.alumnos;
  const objetivos = claseEnVivo.objetivos ?? [];
  const recordatoriosTotal = recordatorios.length;
  const recordatoriosHechos = recordatorios.filter((r) => r.completado).length;

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-primary-500 bg-white p-6 shadow-xl animate-bounce-subtle">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary-100 opacity-20" />
      <div className="relative space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shrink-0">
              <Rocket className="h-7 w-7 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-600 animate-ping" />
                  En vivo ahora
                </span>
                {tiempoTexto && (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${tiempoTexto.pasado ? "text-warning-600" : "text-surface-500"}`}>
                    <Clock size={11} />
                    {tiempoTexto.inicio} → {tiempoTexto.fin}
                    {tiempoTexto.pasado && ` · +${tiempoTexto.excesoMin}min`}
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-2xl font-black text-surface-900 leading-tight truncate">
                Estás en clase con {alumno?.nombre ?? "—"}
              </h2>
              {claseEnVivo.tema_previsto && (
                <p className="mt-0.5 text-sm font-medium text-surface-500">
                  Tema: <span className="text-surface-700">{claseEnVivo.tema_previsto}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Objetivos */}
        {objetivos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target size={14} className="text-primary-600" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-surface-600">
                Objetivos
              </span>
            </div>
            <ul className="space-y-1 pl-1">
              {objetivos.map((obj, i) => (
                <li key={i} className="text-sm text-surface-700 flex items-start gap-2">
                  <span className="text-primary-500 mt-0.5">•</span>
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recordatorios */}
        {recordatoriosTotal > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-warning-600" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-surface-600">
                  Recordatorios
                </span>
              </div>
              <span className="text-[10px] font-bold text-surface-400">
                {recordatoriosHechos}/{recordatoriosTotal}
              </span>
            </div>
            <ul className="space-y-1.5">
              {recordatorios.map((r) => (
                <li key={r.id}>
                  <label className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={r.completado}
                      onChange={() => toggleRecordatorio(r.id)}
                      className="mt-0.5 h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <span className={`text-sm ${r.completado ? "line-through text-surface-400" : "text-surface-700 group-hover:text-surface-900"}`}>
                      {r.texto}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Continuidad pedagógica */}
        {ultimaClase && (
          <div className="rounded-xl border border-surface-200 bg-surface-50/40 p-3">
            <div className="flex items-center gap-2 mb-1">
              <History size={13} className="text-surface-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-surface-500">
                Continuidad
              </span>
            </div>
            <p className="text-xs text-surface-600">
              <span className="text-surface-400">Última clase ({fmtFechaCorta(ultimaClase.fecha)}), planeaste:</span>{" "}
              <span className="text-surface-800 font-medium">{ultimaClase.plan_proxima}</span>
            </p>
          </div>
        )}

        {/* Notas en vivo */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <NotebookPen size={14} className="text-primary-600" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-surface-600">
                Notas en vivo
              </span>
            </div>
            <span className="text-[10px] text-surface-400 italic">
              {savingNotas ? "Guardando…" : "Autosave"}
            </span>
          </div>
          <textarea
            value={notasVivo}
            onChange={(e) => onChangeNotas(e.target.value)}
            placeholder="Anotá lo que va saliendo en la clase. Se guarda solo."
            rows={3}
            maxLength={5000}
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 resize-y"
          />
        </div>

        {/* Acciones de cierre */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-surface-100">
          <Link
            href={`/clases/nueva?alumnoId=${claseEnVivo.alumno_id}&tema=${encodeURIComponent(claseEnVivo.tema_previsto || "")}&agendaId=${claseEnVivo.id}`}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-primary-700 transition-all active:scale-95"
          >
            <Sparkles size={18} />
            Cierre Pedagógico
          </Link>
          <button
            onClick={handleExpressClose}
            disabled={isClosingExpress}
            className="sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-surface-100 border border-surface-200 px-5 py-3 text-sm font-bold text-surface-700 hover:bg-surface-200 transition-all active:scale-95 disabled:opacity-50"
          >
            {isClosingExpress ? (
              <>
                <CheckCircle2 size={16} className="animate-pulse text-success-500" />
                Cerrando…
              </>
            ) : (
              <>
                <Zap size={16} className="text-warning-500" />
                Cierre Rápido
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtFechaCorta(iso: string): string {
  try {
    return new Date(iso + (iso.includes("T") ? "" : "T12:00:00"))
      .toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}
