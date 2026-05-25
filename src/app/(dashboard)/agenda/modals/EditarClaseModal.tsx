"use client";

import { useState } from "react";
import { X, Clock, Calendar, Trash2 } from "lucide-react";
import type { AgendaItem } from "@/lib/types/database";

export default function EditarClaseModal({
  item,
  onClose,
  alumnos,
}: {
  item: AgendaItem;
  onClose: () => void;
  alumnos: { id: string; nombre: string; apellido: string }[];
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    alumno_id: item.alumno_id,
    hora: String(item.hora).substring(0, 5),
    fecha: item.fecha,
    tema_previsto: item.tema_previsto || "",
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const { actualizarClase } = await import("../actions");
      await actualizarClase(item.id, formData);
      onClose();
    } catch (error: unknown) {
      setErrorMsg("Error: " + ((error as Error).message || "No se pudo actualizar"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Estás segura de que querés eliminar esta clase?")) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const { eliminarPlanificacion } = await import("../actions");
      await eliminarPlanificacion(item.id);
      onClose();
    } catch (error: unknown) {
      setErrorMsg("Error: " + ((error as Error).message || "No se pudo eliminar"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/40 p-4 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-scale-up border border-surface-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-surface-900">Editar Clase</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
            aria-label="Cerrar"
          >
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
              {alumnos.map((a) => (
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
              <label className="text-xs font-bold text-surface-700 uppercase tracking-wider flex items-center gap-1"><Calendar size={12} /> Día</label>
              <input
                type="date" required
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all"
              />
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
