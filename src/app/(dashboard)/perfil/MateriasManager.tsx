"use client";

import { useState, useTransition } from "react";
import { Plus, X, Eye, EyeOff, Crown } from "lucide-react";
import { addCustomMateria, deleteCustomMateria, toggleBaseMateria } from "./materias-actions";
import type { MateriaOption } from "@/lib/materias";

interface MateriasManagerProps {
  isPremium: boolean;
  baseMaterias: { value: string; label: string; isHidden: boolean }[];
  customMaterias: { id: string; nombre: string }[];
}

export default function MateriasManager({
  isPremium,
  baseMaterias,
  customMaterias,
}: MateriasManagerProps) {
  const [newMateria, setNewMateria] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAddCustom = () => {
    if (newMateria.trim().length < 2) return;
    setError(null);
    startTransition(async () => {
      try {
        await addCustomMateria(newMateria);
        setNewMateria("");
      } catch (err: any) {
        setError(err.message);
      }
    });
  };

  const handleDeleteCustom = (id: string) => {
    startTransition(async () => {
      try {
        await deleteCustomMateria(id);
      } catch (err: any) {
        setError(err.message);
      }
    });
  };

  const handleToggleBase = (value: string, currentlyHidden: boolean) => {
    setError(null);
    startTransition(async () => {
      try {
        await toggleBaseMateria(value, !currentlyHidden);
      } catch (err: any) {
        setError(err.message);
      }
    });
  };

  if (!isPremium) {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Crown size={20} className="text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">Materias Personalizadas</p>
            <p className="text-xs text-amber-600">
              Con Premium podés agregar tus propias materias y ocultar las que no uses.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-surface-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-100 bg-surface-50/50">
        <h3 className="text-sm font-bold text-surface-900">Materias</h3>
      </div>
      <div className="p-6 space-y-5">
        {error && (
          <p className="text-xs font-bold text-danger-500 bg-danger-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Base Materias */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">
            Materias Base
          </p>
          <div className="space-y-2">
            {baseMaterias.map((m) => (
              <div
                key={m.value}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${
                  m.isHidden
                    ? "bg-surface-50 text-surface-400"
                    : "bg-white text-surface-900 border border-surface-100"
                }`}
              >
                <span className={`text-sm font-medium ${m.isHidden ? "line-through" : ""}`}>
                  {m.label}
                </span>
                <button
                  onClick={() => handleToggleBase(m.value, m.isHidden)}
                  disabled={isPending}
                  className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors disabled:opacity-50"
                  title={m.isHidden ? "Mostrar" : "Ocultar"}
                >
                  {m.isHidden ? (
                    <EyeOff size={14} className="text-surface-400" />
                  ) : (
                    <Eye size={14} className="text-surface-500" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Materias */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-surface-400 mb-3">
            Tus Materias
          </p>
          {customMaterias.length > 0 ? (
            <div className="space-y-2 mb-3">
              {customMaterias.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg bg-primary-50 border border-primary-100 px-3 py-2.5"
                >
                  <span className="text-sm font-medium text-primary-800">{m.nombre}</span>
                  <button
                    onClick={() => handleDeleteCustom(m.id)}
                    disabled={isPending}
                    className="p-1.5 rounded-lg text-danger-400 hover:bg-danger-50 hover:text-danger-600 transition-colors disabled:opacity-50"
                    title="Eliminar"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-surface-400 italic mb-3">
              Todavía no agregaste materias personalizadas.
            </p>
          )}

          {/* Add New */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newMateria}
              onChange={(e) => setNewMateria(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
              placeholder="Ej: Inglés, Música..."
              className="flex-1 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            <button
              onClick={handleAddCustom}
              disabled={isPending || newMateria.trim().length < 2}
              className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-bold text-white hover:bg-primary-700 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <Plus size={14} /> Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
