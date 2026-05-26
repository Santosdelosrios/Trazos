"use client";

import { useState, useTransition } from "react";
import { Plus, Users, X } from "lucide-react";
import { crearFamilia } from "@/app/(dashboard)/familias/actions";

interface Props {
  /** Se llama con el id de la familia recién creada para que el padre
   *  la pueda preseleccionar. */
  onCreated: (familia: { id: string; nombre: string; responsable_nombre: string | null }) => void;
}

/**
 * Mini-form embebido dentro del modal del alumno para crear una familia
 * sin tener que salir de la ficha. Solo pide los campos imprescindibles;
 * la edición completa (datos de pago, notas) se hace después desde
 * /finanzas/cuentas. Mantiene PR-1 acotado.
 */
export default function NuevaFamiliaInline({ onCreated }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [responsableNombre, setResponsableNombre] = useState("");
  const [responsableTelefono, setResponsableTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setNombre("");
    setResponsableNombre("");
    setResponsableTelefono("");
    setError(null);
    setAbierto(false);
  }

  function handleCrear() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await crearFamilia({
          nombre,
          responsable_nombre: responsableNombre || null,
          responsable_telefono: responsableTelefono || null,
        });
        onCreated({
          id: res.id,
          nombre,
          responsable_nombre: responsableNombre || null,
        });
        reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo crear la familia.");
      }
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline"
      >
        <Plus size={12} /> Nueva familia
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-primary-200 bg-primary-50/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary-700 flex items-center gap-1">
          <Users size={12} /> Crear nueva familia
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-700"
          aria-label="Cancelar"
        >
          <X size={14} />
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-50 px-2 py-1 text-[11px] font-semibold text-danger-600">
          {error}
        </p>
      )}

      <div>
        <label className="block text-[11px] font-semibold text-surface-600 mb-1">
          Nombre de la familia <span className="text-danger-500">*</span>
        </label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Familia Pérez"
          className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-semibold text-surface-600 mb-1">Responsable</label>
          <input
            type="text"
            value={responsableNombre}
            onChange={(e) => setResponsableNombre(e.target.value)}
            placeholder="Ej: Mariana"
            className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-surface-600 mb-1">Teléfono</label>
          <input
            type="tel"
            value={responsableTelefono}
            onChange={(e) => setResponsableTelefono(e.target.value)}
            placeholder="11 2345 6789"
            className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCrear}
          disabled={pending || !nombre.trim()}
          className="flex-1 rounded-xl bg-primary-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {pending ? "Creando…" : "Crear y asignar"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-surface-100 px-3 py-2 text-xs font-semibold text-surface-700 hover:bg-surface-200 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
