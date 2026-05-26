"use client";

import { useState, useTransition } from "react";
import { Pencil, X, Save } from "lucide-react";
import { actualizarPago } from "@/app/(dashboard)/finanzas/actions";
import type { EstadoPago, Pago } from "@/lib/types/database";
import { useToast } from "@/components/ui/Toast";

interface Props {
  pago: Pick<Pago, "id" | "monto" | "estado" | "fecha_pago" | "nota" | "periodo">;
  /** Trigger del modal. Si no se pasa, usa un botón con ícono. */
  trigger?: React.ReactNode;
}

/**
 * Modal compacto para editar un cobro: monto, estado, fecha, nota y
 * periodo. NO maneja medio de pago ni adjunto: eso entra en PR-3 con
 * el modal "Confirmar pago" que aparecerá al pasar a "pagado".
 */
export default function EditarCobroModal({ pago, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [monto, setMonto] = useState<number>(Number(pago.monto));
  const [estado, setEstado] = useState<EstadoPago>(pago.estado);
  const [fechaPago, setFechaPago] = useState<string>(pago.fecha_pago || "");
  const [nota, setNota] = useState<string>(pago.nota || "");
  const [periodo, setPeriodo] = useState<string>(pago.periodo || "");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function reset() {
    setMonto(Number(pago.monto));
    setEstado(pago.estado);
    setFechaPago(pago.fecha_pago || "");
    setNota(pago.nota || "");
    setPeriodo(pago.periodo || "");
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await actualizarPago(pago.id, {
          monto,
          estado,
          fecha_pago: fechaPago || null,
          nota: nota || null,
          periodo: periodo || null,
        });
        toast.success("Cobro actualizado");
        setOpen(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No se pudo actualizar.";
        toast.error(msg);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-surface-400 hover:bg-primary-50 hover:text-primary-600 transition-colors"
        title="Editar cobro"
        aria-label="Editar cobro"
      >
        {trigger ?? <Pencil size={16} />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm animate-fade-in-up">
          <div className="absolute inset-0" onClick={reset} />
          <div className="relative w-full max-w-md overflow-y-auto max-h-[90vh] rounded-3xl bg-white border border-surface-200 shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between pb-4 border-b border-surface-100 mb-4">
              <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                <Pencil size={18} className="text-primary-600" /> Editar cobro
              </h3>
              <button
                type="button"
                onClick={reset}
                className="rounded-xl p-2 text-surface-400 hover:bg-surface-100"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-1">
                  Monto
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-surface-400">$</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={100}
                    required
                    value={monto}
                    onChange={(e) => setMonto(Number(e.target.value))}
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 pl-8 pr-4 py-2 text-sm font-medium focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-1">
                  Estado
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoPago)}
                  className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2 text-sm font-medium focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="pagado">Pagado</option>
                  <option value="parcial">Parcial</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-1">
                    Fecha de pago
                  </label>
                  <input
                    type="date"
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-1">
                    Período <span className="font-normal normal-case text-surface-400">(abono)</span>
                  </label>
                  <input
                    type="month"
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-1">
                  Nota
                </label>
                <input
                  type="text"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  maxLength={300}
                  placeholder="Ej: pagó por transferencia"
                  className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-100">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-xl px-4 py-2 text-sm font-bold text-surface-600 hover:bg-surface-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2 text-sm font-bold text-white shadow-sm hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 transition-all"
                >
                  {pending ? "Guardando…" : <><Save size={14} /> Guardar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
