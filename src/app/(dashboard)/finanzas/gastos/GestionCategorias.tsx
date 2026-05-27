"use client";

import { useState, useTransition } from "react";
import { Tag, X, Plus, Trash2, Save, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  crearCategoriaGasto,
  eliminarCategoriaGasto,
} from "./categorias-actions";
import type { CategoriaGastoCustom } from "@/lib/types/database";

interface Props {
  categorias: CategoriaGastoCustom[];
}

/**
 * Modal de gestión de categorías de gasto. Permite:
 *  - Listar las default (no eliminables) y las custom.
 *  - Crear una categoría nueva (solo nombre por ahora; ícono queda
 *    en NULL → la UI cae al ícono "Otro" para esas).
 *  - Eliminar (soft) las custom.
 *
 * La edición de nombre/ícono queda para una iteración futura — el
 * caso de uso principal es agregar/quitar, no renombrar.
 */
export default function GestionCategorias({ categorias }: Props) {
  const [open, setOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    startTransition(async () => {
      try {
        await crearCategoriaGasto({ nombre });
        setNuevoNombre("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo crear.");
      }
    });
  }

  function handleEliminar(id: string, nombre: string) {
    if (!window.confirm(`¿Eliminar la categoría "${nombre}"? Los gastos ya cargados se mantienen, pero quedan etiquetados como "(categoría eliminada)".`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await eliminarCategoriaGasto(id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo eliminar.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-surface-100 px-4 py-3 text-sm font-bold text-surface-700 hover:bg-primary-50 hover:text-primary-700 transition-all active:scale-[0.98] border border-surface-200"
      >
        <Tag size={14} /> Gestionar categorías
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-surface-900/40 backdrop-blur-sm animate-fade-in-up">
      <div className="absolute inset-0" onClick={() => setOpen(false)} />
      <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white border border-surface-200 shadow-2xl z-10">
        <div className="sticky top-0 z-10 bg-white border-b border-surface-100 px-5 py-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
            <Tag size={18} className="text-primary-600" /> Categorías de gasto
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl p-2 text-surface-400 hover:bg-surface-100"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <p className="rounded-lg bg-danger-50 border border-danger-200 px-3 py-2 text-xs font-semibold text-danger-700">
              {error}
            </p>
          )}

          {/* Lista */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-2">
              Tus categorías
            </p>
            <div className="space-y-1.5">
              {categorias.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50/40 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-surface-900 truncate">
                      {c.nombre}
                    </span>
                    {c.es_default && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-surface-200 text-surface-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                        <Lock size={9} /> Default
                      </span>
                    )}
                  </div>
                  {!c.es_default && (
                    <button
                      type="button"
                      onClick={() => handleEliminar(c.id, c.nombre)}
                      disabled={pending}
                      className="rounded-lg p-1.5 text-surface-400 hover:bg-danger-50 hover:text-danger-500 disabled:opacity-50 transition-colors"
                      aria-label={`Eliminar ${c.nombre}`}
                      title="Eliminar categoría"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {categorias.length === 0 && (
                <p className="text-xs text-surface-400 italic">
                  Todavía no tenés categorías. Creá la primera abajo.
                </p>
              )}
            </div>
          </div>

          {/* Crear nueva */}
          <form
            onSubmit={handleCrear}
            className="rounded-xl border border-primary-200 bg-primary-50/40 p-3 space-y-2"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary-700">
              Nueva categoría
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                maxLength={60}
                placeholder="Ej: Librería, Software, etc."
                className="flex-1 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm font-medium focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
              <button
                type="submit"
                disabled={pending || !nuevoNombre.trim()}
                className="flex items-center gap-1 rounded-xl bg-primary-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
              >
                <Plus size={14} /> Crear
              </button>
            </div>
          </form>

          <p className="text-[10px] text-surface-400 leading-relaxed">
            Las categorías por defecto no se pueden eliminar. Si querés
            ocultarlas, podés filtrar tus gastos por categoría desde
            esta misma pantalla (próximamente).
          </p>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-surface-100 px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 rounded-xl bg-surface-900 px-4 py-2 text-sm font-bold text-white"
          >
            <Save size={14} /> Listo
          </button>
        </div>
      </div>
    </div>
  );
}
