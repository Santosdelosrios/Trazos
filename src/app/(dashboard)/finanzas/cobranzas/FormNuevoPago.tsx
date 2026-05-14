"use client";

import { useState, useTransition } from "react";
import { registrarPago } from "@/app/(dashboard)/finanzas/actions";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import type { EstadoPago } from "@/lib/types/database";
import { Plus, Save } from "lucide-react";

interface Props {
  alumnos: { id: string; nombre: string; apellido: string }[];
  tarifaActual: number;
}

export default function FormNuevoPago({ alumnos, tarifaActual }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [alumnoId, setAlumnoId] = useState("");
  const [monto, setMonto] = useState(tarifaActual);
  const [estado, setEstado] = useState<EstadoPago>("pendiente");
  const [fechaPago, setFechaPago] = useState("");
  const [nota, setNota] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!alumnoId || monto <= 0) return;

    startTransition(async () => {
      try {
        await registrarPago({
          alumno_id: alumnoId,
          monto,
          estado,
          fecha_pago: fechaPago || undefined,
          nota: nota || undefined,
        });
        // Reset
        setAlumnoId("");
        setMonto(tarifaActual);
        setEstado("pendiente");
        setFechaPago("");
        setNota("");
        setOpen(false);
      } catch (err) {
        console.error("Error al registrar pago:", err);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-3 text-sm font-bold text-white shadow-md hover:from-primary-700 hover:to-primary-800 transition-all active:scale-[0.98]"
      >
        <Plus size={16} /> Nuevo Cobro
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-primary-200 bg-white p-6 shadow-sm animate-fade-in-up space-y-4"
    >
      <h3 className="text-base font-bold text-surface-900">Registrar Cobro</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
            Alumno
          </label>
          <select
            value={alumnoId}
            onChange={(e) => setAlumnoId(e.target.value)}
            required
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm font-semibold text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          >
            <option value="">Seleccionar alumno...</option>
            {alumnos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.apellido}, {a.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
            Monto ($)
          </label>
          <input
            type="number"
            min={0}
            step={100}
            value={monto}
            onChange={(e) => setMonto(Number(e.target.value))}
            required
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm font-semibold text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
          {tarifaActual > 0 && (
            <p className="mt-1 text-[10px] text-surface-400">
              Tarifa vigente: {formatearMonto(tarifaActual)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
            Estado
          </label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoPago)}
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm font-semibold text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          >
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
            <option value="parcial">Parcial</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
            Fecha de pago
          </label>
          <input
            type="date"
            value={fechaPago}
            onChange={(e) => setFechaPago(e.target.value)}
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm font-semibold text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
          Nota (opcional)
        </label>
        <input
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: Pagó por transferencia"
          className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl bg-surface-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-600 transition-all active:scale-95 disabled:opacity-50"
        >
          {isPending ? "Guardando..." : <><Save size={16} /> Guardar Cobro</>}
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
