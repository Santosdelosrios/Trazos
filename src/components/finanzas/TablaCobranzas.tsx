"use client";

import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import type { Pago, EstadoPago } from "@/lib/types/database";
import { ESTADO_PAGO_CONFIG } from "@/lib/types/database";
import { actualizarEstadoPago } from "@/app/(dashboard)/finanzas/actions";
import { useTransition } from "react";
import { recordatorioPago, generarLinkWhatsApp } from "@/lib/finanzas/plantillasWhatsApp";
import { CreditCard, MessageSquare, CheckCircle2, Check } from "lucide-react";

interface PagoConAlumno extends Omit<Pago, "alumnos"> {
  alumnos?: { nombre: string; apellido: string };
}

interface Props {
  pagos: PagoConAlumno[];
  nombreMaestra: string;
}

export default function TablaCobranzas({ pagos, nombreMaestra }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleCambiarEstado(id: string, nuevoEstado: EstadoPago) {
    startTransition(async () => {
      try {
        await actualizarEstadoPago(id, nuevoEstado);
      } catch (err) {
        console.error("Error al actualizar pago:", err);
      }
    });
  }

  if (pagos.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-200 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-100 text-surface-400">
          <CreditCard size={24} />
        </div>
        <p className="text-sm font-medium text-surface-500">
          No hay cobros registrados todavía.
        </p>
        <p className="mt-1 text-xs text-surface-400">
          Registrá un pago desde el botón &quot;Nuevo Cobro&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-100 bg-surface-50/50">
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-surface-400">
                Alumno
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-surface-400">
                Monto
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-surface-400">
                Estado
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-surface-400">
                Fecha
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-surface-400">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {pagos.map((pago) => {
              const config = ESTADO_PAGO_CONFIG[pago.estado];
              return (
                <tr
                  key={pago.id}
                  className="transition-colors hover:bg-surface-50/50"
                >
                  <td className="px-4 py-3 font-semibold text-surface-900">
                    {pago.alumnos
                      ? `${pago.alumnos.nombre} ${pago.alumnos.apellido}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-bold text-surface-900">
                    {formatearMonto(pago.monto)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${config.bg} ${config.color}`}
                    >
                      {config.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-surface-500">
                    {pago.fecha_pago
                      ? new Date(pago.fecha_pago + "T12:00:00").toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {pago.estado === "pendiente" && (
                        <>
                          <a
                            href={generarLinkWhatsApp(
                              "", // Podríamos traer el teléfono del alumno si estuviera en la DB
                              recordatorioPago({
                                nombreMaestra,
                                alumno: {
                                  nombre: pago.alumnos?.nombre ?? "Alumno",
                                  apellido: pago.alumnos?.apellido ?? ""
                                },
                                monto: pago.monto
                              })
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-surface-100 p-2 text-surface-600 hover:bg-surface-200 transition-colors"
                            title="Enviar recordatorio por WhatsApp"
                          >
                             <MessageSquare size={16} />
                            </a>
                            <button
                              onClick={() => handleCambiarEstado(pago.id, "pagado")}
                              disabled={isPending}
                              className="flex items-center gap-1.5 rounded-lg bg-success-500 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm hover:bg-success-400 transition-all active:scale-95 disabled:opacity-50"
                            >
                              <CheckCircle2 size={12} /> Marcar Pagado
                            </button>
                        </>
                      )}
                      {pago.estado === "pagado" && (
                        <span className="flex items-center gap-1 text-xs text-surface-400 italic">
                          Cobrado <Check size={14} />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
