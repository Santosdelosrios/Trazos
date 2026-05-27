"use client";

import { useState, useTransition } from "react";
import { registrarGasto } from "@/app/(dashboard)/finanzas/actions";
import type { CategoriaGasto, CategoriaGastoCustom } from "@/lib/types/database";
import { Plus, Save } from "lucide-react";
import FormField, { FIELD_INPUT_CLASS, FIELD_INPUT_CLASS_PLAIN } from "@/components/ui/FormField";
import { useToast } from "@/components/ui/Toast";

interface Props {
  /** PR-6: categorías editables de la maestra. Si está vacío usamos los
   *  5 valores del enum legacy (fallback para entornos viejos sin
   *  seeder corrido). */
  categorias: CategoriaGastoCustom[];
}

export default function FormNuevoGasto({ categorias }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [categoriaId, setCategoriaId] = useState<string>(
    () => categorias[0]?.id ?? "material"
  );
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState(0);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [recurrente, setRecurrente] = useState(false);
  const toast = useToast();

  const usandoCustom = categorias.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (monto <= 0) return;

    startTransition(async () => {
      try {
        // PR-6: si tenemos categorías custom mandamos categoria_id;
        // la action resuelve el enum legacy desde el server.
        // Fallback legacy: si no hay categorías (DB sin seeder), mandamos
        // el enum directo.
        const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId);
        await registrarGasto({
          categoria: (categoriaSeleccionada?.enum_legacy ?? "otro") as CategoriaGasto,
          categoria_id: usandoCustom ? categoriaId : null,
          descripcion: descripcion || undefined,
          monto,
          fecha,
          recurrente,
        });
        toast.success(`Gasto registrado por $${monto.toLocaleString("es-AR")}`);
        setDescripcion("");
        setMonto(0);
        setRecurrente(false);
        setOpen(false);
      } catch (err) {
        console.error("Error al registrar gasto:", err);
        const msg = err instanceof Error ? err.message : "No se pudo registrar el gasto";
        toast.error(msg);
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
      className="w-full rounded-2xl border border-primary-200 bg-white p-6 shadow-sm animate-fade-in-up space-y-4"
    >
      <h3 className="text-base font-bold text-surface-900">Registrar Gasto</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Categoría">
          {usandoCustom ? (
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className={FIELD_INPUT_CLASS}
              required
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          ) : (
            // Fallback legacy: si no hay seeder (entorno sin migración 022)
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className={FIELD_INPUT_CLASS}
            >
              <option value="viatico">Viático</option>
              <option value="material">Material</option>
              <option value="plataforma">Plataforma</option>
              <option value="impuesto">Impuesto</option>
              <option value="otro">Otro</option>
            </select>
          )}
        </FormField>

        <FormField label="Monto ($)">
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={0}
            step={100}
            value={monto}
            onChange={(e) => setMonto(Number(e.target.value))}
            required
            className={FIELD_INPUT_CLASS}
          />
        </FormField>

        <FormField label="Descripción">
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Colectivo ida y vuelta"
            className={FIELD_INPUT_CLASS_PLAIN}
          />
        </FormField>

        <FormField label="Fecha">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={FIELD_INPUT_CLASS}
          />
        </FormField>
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
