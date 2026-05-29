"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  Sparkles, Rocket, Clock, Zap, CheckCircle2,
  Target, Bell, Pencil, Plus, Trash2, Check, X,
} from "lucide-react";
import type { AgendaItem, RecordatorioClase } from "@/lib/types/database";
import { cerrarClaseExpress, actualizarPlanificacionAgenda } from "../actions";

export default function OpcionesClaseModal({
  item,
  onClose,
  onEdit,
  onPreparar,
}: {
  item: AgendaItem;
  onClose: () => void;
  onEdit: () => void;
  onPreparar: () => void;
}) {
  const [isClosingExpress, setIsClosingExpress] = useState(false);
  // Estado para mostrar/ocultar el editor inline de planificación.
  const [editandoPlan, setEditandoPlan] = useState(false);
  // Estado local de la planificación (read-only mientras no se edita).
  const [objetivos, setObjetivos] = useState<string[]>(item.objetivos ?? []);
  const [recordatorios, setRecordatorios] = useState<RecordatorioClase[]>(item.recordatorios ?? []);
  const [tema, setTema] = useState<string>(item.tema_previsto ?? "");
  const [nuevoObj, setNuevoObj] = useState("");
  const [nuevoRec, setNuevoRec] = useState("");
  const [saving, startSaving] = useTransition();

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

  const tienePlanificacion =
    (item.objetivos?.length ?? 0) > 0 ||
    (item.recordatorios?.length ?? 0) > 0 ||
    (item.tema_previsto && item.tema_previsto.trim() !== "");

  // ----- Edit handlers (solo cuando editandoPlan = true) -----
  const agregarObjetivo = () => {
    const t = nuevoObj.trim();
    if (!t || objetivos.length >= 20) return;
    setObjetivos([...objetivos, t]);
    setNuevoObj("");
  };
  const quitarObjetivo = (idx: number) => {
    setObjetivos(objetivos.filter((_, i) => i !== idx));
  };
  const agregarRecordatorio = () => {
    const t = nuevoRec.trim();
    if (!t || recordatorios.length >= 20) return;
    setRecordatorios([
      ...recordatorios,
      {
        id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        texto: t,
        completado: false,
      },
    ]);
    setNuevoRec("");
  };
  const quitarRecordatorio = (id: string) => {
    setRecordatorios(recordatorios.filter((r) => r.id !== id));
  };
  const toggleRecordatorio = (id: string) => {
    setRecordatorios(recordatorios.map((r) =>
      r.id === id ? { ...r, completado: !r.completado } : r,
    ));
  };

  const guardarPlan = () => {
    startSaving(async () => {
      try {
        await actualizarPlanificacionAgenda(item.id, {
          tema_previsto: tema,
          objetivos,
          recordatorios,
        });
        setEditandoPlan(false);
      } catch (e) {
        console.error(e);
      }
    });
  };

  const cancelarEdicion = () => {
    // Volver al estado original que vino en la prop.
    setObjetivos(item.objetivos ?? []);
    setRecordatorios(item.recordatorios ?? []);
    setTema(item.tema_previsto ?? "");
    setNuevoObj("");
    setNuevoRec("");
    setEditandoPlan(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — ancho ampliado para que entre la planificación */}
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-7 shadow-2xl animate-scale-up border border-surface-100">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <Sparkles size={22} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-surface-400 mb-1">Clase con</p>
          <h3 className="text-xl font-black text-surface-900 leading-tight">
            {item.alumnos?.nombre} {item.alumnos?.apellido}
          </h3>
          {item.tema_previsto && !editandoPlan && (
            <p className="mt-1 text-xs text-surface-500">
              Tema: <span className="text-surface-700 font-medium">{item.tema_previsto}</span>
            </p>
          )}
        </div>

        {/* PLANIFICACIÓN: vista o editor */}
        {!editandoPlan ? (
          <div className="mb-5 rounded-2xl border border-surface-150 bg-surface-50/40 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-surface-500">
                Planificación
              </p>
              <button
                onClick={() => setEditandoPlan(true)}
                className="flex items-center gap-1 text-[10px] font-bold text-primary-600 hover:text-primary-700"
              >
                <Pencil size={11} /> {tienePlanificacion ? "Editar" : "Agregar"}
              </button>
            </div>

            {!tienePlanificacion ? (
              <p className="text-xs text-surface-400 italic">
                Sin objetivos ni recordatorios todavía.
              </p>
            ) : (
              <div className="space-y-3">
                {(item.objetivos?.length ?? 0) > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Target size={11} className="text-primary-600" />
                      <span className="text-[10px] font-bold uppercase text-surface-500">
                        Objetivos
                      </span>
                    </div>
                    <ul className="space-y-0.5 pl-1">
                      {item.objetivos!.map((obj, i) => (
                        <li key={i} className="text-xs text-surface-700 flex items-start gap-1.5">
                          <span className="text-primary-400 mt-0.5">•</span>
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(item.recordatorios?.length ?? 0) > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Bell size={11} className="text-warning-600" />
                      <span className="text-[10px] font-bold uppercase text-surface-500">
                        Recordatorios
                      </span>
                      <span className="text-[10px] text-surface-400 ml-auto">
                        {item.recordatorios!.filter((r) => r.completado).length}/{item.recordatorios!.length}
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {item.recordatorios!.map((r) => (
                        <li key={r.id} className="flex items-start gap-1.5 text-xs">
                          <span className={`shrink-0 mt-0.5 flex h-3 w-3 items-center justify-center rounded border ${
                            r.completado
                              ? "bg-success-500 border-success-500 text-white"
                              : "bg-white border-surface-300 text-transparent"
                          }`}>
                            <Check size={8} strokeWidth={3} />
                          </span>
                          <span className={r.completado ? "line-through text-surface-400" : "text-surface-700"}>
                            {r.texto}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* EDITOR de planificación */
          <div className="mb-5 rounded-2xl border-2 border-primary-200 bg-primary-50/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-wider text-primary-700">
                Editando planificación
              </p>
              <button
                onClick={cancelarEdicion}
                disabled={saving}
                className="text-surface-400 hover:text-surface-700 p-1"
                aria-label="Cancelar"
              >
                <X size={14} />
              </button>
            </div>

            {/* Tema */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-surface-600">Tema previsto</label>
              <input
                type="text"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                maxLength={200}
                placeholder="Ej: Fracciones equivalentes"
                className="w-full rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>

            {/* Objetivos */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Target size={11} className="text-primary-600" />
                <label className="text-[10px] font-bold uppercase text-surface-600">Objetivos</label>
              </div>
              {objetivos.length > 0 && (
                <ul className="space-y-1">
                  {objetivos.map((obj, i) => (
                    <li key={i} className="flex items-center justify-between gap-1 rounded bg-white border border-surface-200 px-2 py-1 text-xs">
                      <span className="flex-1 text-surface-700">{obj}</span>
                      <button onClick={() => quitarObjetivo(i)} className="text-surface-400 hover:text-danger-500">
                        <Trash2 size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={nuevoObj}
                  maxLength={200}
                  onChange={(e) => setNuevoObj(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); agregarObjetivo(); }
                  }}
                  placeholder="Nuevo objetivo"
                  className="flex-1 rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
                <button
                  onClick={agregarObjetivo}
                  disabled={!nuevoObj.trim()}
                  className="rounded-lg bg-primary-600 px-2 py-1 text-xs font-bold text-white hover:bg-primary-700 disabled:opacity-40"
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>

            {/* Recordatorios */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Bell size={11} className="text-warning-600" />
                <label className="text-[10px] font-bold uppercase text-surface-600">Recordatorios</label>
              </div>
              {recordatorios.length > 0 && (
                <ul className="space-y-1">
                  {recordatorios.map((r) => (
                    <li key={r.id} className="flex items-center gap-1.5 rounded bg-white border border-surface-200 px-2 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={r.completado}
                        onChange={() => toggleRecordatorio(r.id)}
                        className="h-3 w-3 rounded border-surface-300 text-primary-600 cursor-pointer"
                      />
                      <span className={`flex-1 ${r.completado ? "line-through text-surface-400" : "text-surface-700"}`}>
                        {r.texto}
                      </span>
                      <button onClick={() => quitarRecordatorio(r.id)} className="text-surface-400 hover:text-danger-500">
                        <Trash2 size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={nuevoRec}
                  maxLength={200}
                  onChange={(e) => setNuevoRec(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); agregarRecordatorio(); }
                  }}
                  placeholder="Nuevo recordatorio"
                  className="flex-1 rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
                <button
                  onClick={agregarRecordatorio}
                  disabled={!nuevoRec.trim()}
                  className="rounded-lg bg-warning-600 px-2 py-1 text-xs font-bold text-white hover:bg-warning-700 disabled:opacity-40"
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>

            {/* Botón guardar */}
            <button
              onClick={guardarPlan}
              disabled={saving}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-bold text-white hover:bg-primary-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <>Guardando…</>
              ) : (
                <><CheckCircle2 size={12} /> Guardar planificación</>
              )}
            </button>
          </div>
        )}

        {/* ACCIONES DE CLASE (no se muestran mientras se edita el plan) */}
        {!editandoPlan && (
          <div className="space-y-2.5">
            {canFinalize ? (
              <>
                <button
                  onClick={handleExpressClose}
                  disabled={isClosingExpress}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-surface-900 px-6 py-3.5 text-sm font-black text-white shadow-lg hover:bg-surface-800 transition-all active:scale-95 disabled:opacity-50"
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
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary-50 px-6 py-3.5 text-sm font-bold text-primary-700 hover:bg-primary-100 transition-all active:scale-95 border border-primary-200"
                >
                  <Sparkles size={18} strokeWidth={2.5} />
                  Cierre con Tiza
                </Link>
              </>
            ) : (
              <div className="group relative">
                <button
                  disabled
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-surface-100 px-6 py-3.5 text-sm font-black text-surface-400 cursor-not-allowed opacity-60"
                >
                  <Rocket size={18} strokeWidth={2.5} />
                  Finalizar clase
                </button>
                <p className="mt-1.5 text-center text-[10px] font-bold text-amber-600">
                  Disponible cuando empiece la clase
                </p>
              </div>
            )}

            <button
              onClick={onPreparar}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary-50 px-6 py-3.5 text-sm font-bold text-primary-700 hover:bg-primary-100 transition-all active:scale-95 border border-primary-200"
            >
              <Rocket size={18} strokeWidth={2.5} />
              Preparar con Tiza
            </button>

            <button
              onClick={onEdit}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-surface-50 px-6 py-3.5 text-sm font-bold text-surface-700 hover:bg-surface-100 transition-all active:scale-95 border border-surface-100"
            >
              <Clock size={18} />
              Editar fecha/horario
            </button>
          </div>
        )}

        {!editandoPlan && (
          <button
            onClick={onClose}
            className="mt-6 w-full text-[10px] font-black uppercase tracking-widest text-surface-400 hover:text-surface-600 transition-colors"
          >
            Cerrar
          </button>
        )}
      </div>
    </div>
  );
}
