"use client";

import { useTransition } from "react";
import { Wallet, Trash2 } from "lucide-react";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import { formatFechaDiaMes } from "@/lib/utils/fechas";
import { useToast } from "@/components/ui/Toast";
import type { MedioPago } from "@/lib/types/database";

export interface CobroLibre {
  id: string;
  alumno_id: string;
  monto: number;
  monto_libre: number;
  fecha: string;
  medio_pago: MedioPago | null;
  nota: string | null;
  alumnos?: {
    nombre: string;
    apellido: string;
  };
}

interface Props {
  cobros: CobroLibre[];
}

/**
 * Muestra los cobros recibidos que NO están imputados a ningún cargo.
 * Representan "saldo a favor" del alumno: plata recibida que excedió
 * las deudas pendientes (o que se cobró antes de que existieran los
 * cargos).
 *
 * Se renderiza encima de la tabla de cargos en /finanzas/cobranzas
 * para que la maestra vea estos cobros y pueda eliminarlos si fueron
 * un error. La auto-imputación FIFO de registrarCobro debería cubrir
 * la mayoría de los casos, pero los cobros excedentes terminan acá.
 */
export default function CobrosSinImputar({ cobros }: Props) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function handleEliminar(id: string) {
    if (!window.confirm("¿Eliminar este cobro? El alumno perderá el saldo a favor correspondiente.")) {
      return;
    }
    startTransition(async () => {
      try {
        const { eliminarCobro } = await import("@/app/(dashboard)/finanzas/actions");
        await eliminarCobro(id);
        toast.success("Cobro eliminado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
      }
    });
  }

  if (cobros.length === 0) return null;

  const totalLibre = cobros.reduce((acc, c) => acc + Number(c.monto_libre), 0);

  return (
    <div className="rounded-2xl border border-success-200 bg-success-50/40 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-100 text-success-700">
            <Wallet size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-surface-900">
              Cobros sin imputar
            </h3>
            <p className="text-[11px] text-surface-500">
              Plata recibida que excede las deudas pendientes ({cobros.length} {cobros.length === 1 ? "cobro" : "cobros"}, total {formatearMonto(totalLibre)})
            </p>
          </div>
        </div>
      </div>

      <ul className="divide-y divide-success-100">
        {cobros.map((c) => {
          const nombre = c.alumnos
            ? `${c.alumnos.nombre} ${c.alumnos.apellido}`
            : "—";
          return (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-900 truncate">
                  {nombre}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-surface-500">
                  <span>{formatFechaDiaMes(c.fecha)}</span>
                  {c.medio_pago && (
                    <>
                      <span>·</span>
                      <span className="capitalize">{c.medio_pago}</span>
                    </>
                  )}
                  {c.nota && (
                    <>
                      <span>·</span>
                      <span className="italic truncate">{c.nota}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-sm font-bold text-success-700">
                    {formatearMonto(Number(c.monto_libre))}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-success-600">
                    saldo a favor
                  </p>
                </div>
                <button
                  onClick={() => handleEliminar(c.id)}
                  disabled={pending}
                  className="rounded-lg p-2 text-surface-400 hover:bg-danger-50 hover:text-danger-500 transition-colors disabled:opacity-50"
                  title="Eliminar cobro"
                  aria-label="Eliminar cobro sin imputar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
