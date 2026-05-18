"use client";

import { useState } from "react";
import { updateAlumno } from "../actions";
import { Pencil, X, Sparkles, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import NivelEducativoSelector from "@/components/alumnos/NivelEducativoSelector";

interface Alumno {
  id: string;
  nombre: string;
  apellido: string;
  grado: string;
  notas?: string | null;
}

export default function EditarAlumnoModal({ alumno }: { alumno: Alumno }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      await updateAlumno(alumno.id, formData);
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al actualizar los datos del alumno.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-xl bg-surface-100 px-3 py-2 text-xs font-bold text-surface-700 hover:bg-primary-50 hover:text-primary-700 transition-all active:scale-95 border border-surface-200"
        title="Editar ficha del alumno"
      >
        <Pencil size={14} />
        <span>Editar ficha</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm animate-fade-in-up">
          <div 
            className="absolute inset-0" 
            onClick={() => setIsOpen(false)}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white border border-surface-200 shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between pb-4 border-b border-surface-100 mb-6">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-600 font-bold">
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-surface-900">
                    Editar ficha
                  </h3>
                  <p className="text-xs text-surface-500">
                    Modificá el nivel, nombre o notas del alumno.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-xl p-2 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-6 rounded-xl bg-danger-50 p-3 text-xs font-semibold text-danger-600 border border-danger-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-500 mb-1">
                    Nombre
                  </label>
                  <input
                    name="nombre"
                    type="text"
                    required
                    defaultValue={alumno.nombre}
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2 text-sm font-medium focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-surface-500 mb-1">
                    Apellido
                  </label>
                  <input
                    name="apellido"
                    type="text"
                    required
                    defaultValue={alumno.apellido}
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2 text-sm font-medium focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-500 mb-2">
                  Nivel educativo actual
                </label>
                <NivelEducativoSelector name="grado" defaultValue={alumno.grado} />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-surface-500 mb-1">
                  Notas u objetivos
                </label>
                <textarea
                  name="notas"
                  rows={3}
                  defaultValue={alumno.notas || ""}
                  placeholder="Objetivos del año, días preferidos, etc."
                  className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2 text-sm font-medium focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-bold text-surface-600 hover:bg-surface-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-primary-700 hover:to-primary-800 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Guardar cambios
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
