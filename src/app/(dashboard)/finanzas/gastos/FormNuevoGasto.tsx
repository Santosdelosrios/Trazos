"use client";

import { useState, useTransition } from "react";
import { registrarGasto } from "@/app/(dashboard)/finanzas/actions";
import type { CategoriaGasto } from "@/lib/types/database";
import { Plus, Save } from "lucide-react";

export default function FormNuevoGasto() {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [categoria, setCategoria] = useState<CategoriaGasto>("material");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState(0);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [recurrente, setRecurrente] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (monto <= 0) return;

    startTransition(async () => {
      try {
        await registrarGasto({
          categoria,
          descripcion: descripcion || undefined,
          monto,
          fecha,
          recurrente,
        });
        setDescripcion("");
        setMonto(0);
        setRecurrente(false);
        setOpen(false);
      } catch (err) {
        console.error("Error al registrar gasto:", err);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-3 text-sm font-bold text-white shadow-md hover:from-primary-700 hover:to-primary-800 transition-all active:scale-[0.98]"
      >
        <Plus size={16} /> Nuevo Gasto
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-primary-200 bg-white p-6 shadow-sm animate-fade-in-up space-y-4"
    >
      <h3 className="text-base font-bold text-surface-900">Registrar Gasto</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
            Categoría
          </label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm font-semibold text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          >
            <option value="viatico">Viático</option>
            <option value="material">Material</option>
            <option value="plataforma">Plataforma</option>
            <option value="impuesto">Impuesto</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
            Monto ($)
          </label>
          <input
            type="number" inputMode="numeric" pattern="[0-9]*"
            min={0}
            step={100}
            value={monto}
            onChange={(e) => setMonto(Number(e.target.value))}
            required
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm font-semibold text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
            Descripción
          </label>
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Colectivo ida y vuelta"
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
            Fecha
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm font-semibold text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={recurrente}
          onChange={(e) => setRecurrente(e.target.checked)}
          className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
        />
        <span className="text-xs font-semibold text-surface-700">
          Es un gasto recurrente (mensual)
        </span>
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl bg-surface-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-600 transition-all active:scale-95 disabled:opacity-50"
        >
          {isPending ? "Guardando..." : <><Save size={16} /> Guardar Gasto</>}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl bg-surface-100 px-4 py-2.5 text-sm font-semibold text-surface-700 hover:bg-surface-200 transition-all"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
