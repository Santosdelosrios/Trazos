"use client";

import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import type { Pago } from "@/lib/types/database";
import { ESTADO_PAGO_CONFIG } from "@/lib/types/database";
import { useTransition } from "react";
import { recordatorioPago, generarLinkWhatsApp } from "@/lib/finanzas/plantillasWhatsApp";
import { obtenerResponsableContacto } from "@/lib/finanzas/responsable";
import { CreditCard, MessageSquare, Check, Trash2 } from "lucide-react";
import { formatFechaDiaMes } from "@/lib/utils/fechas";
import EditarCobroModal from "./EditarCobroModal";
import ConfirmarPagoModal from "./ConfirmarPagoModal";

interface AlumnoEmbed {
  nombre: string;
  apellido: string;
  responsable_nombre?: string | null;
  responsable_telefono?: string | null;
  familia?: {
    responsable_nombre?: string | null;
    responsable_telefono?: string | null;
  } | { responsable_nombre?: string | null; responsable_telefono?: string | null }[] | null;
}

interface PagoConAlumno extends Omit<Pago, "alumnos"> {
  alumnos?: AlumnoEmbed;
}

interface Props {
  pagos: PagoConAlumno[];
  nombreMaestra: string;
  templateRecordatorio?: string | null;
  datosPago?: string | null;
}

function contactoDePago(pago: PagoConAlumno) {
  const a = pago.alumnos;
  if (!a) return { nombre: null, telefono: null, origen: null };
  const fam = Array.isArray(a.familia) ? a.familia[0] : a.familia;
  return obtenerResponsableContacto({
    responsable_nombre: a.responsable_nombre ?? null,
    responsable_telefono: a.responsable_telefono ?? null,
    familia: fam
      ? {
          responsable_nombre: fam.responsable_nombre ?? null,
          responsable_telefono: fam.responsable_telefono ?? null,
        }
      : null,
  });
}

export default function TablaCobranzas({
  pagos, nombreMaestra, templateRecordatorio, datosPago,
}: Props) {
  const [isPending, startTransition] = useTransition();

  function handleEliminar(id: string) {
    if (window.confirm("¿Estás segura de que querés eliminar este registro?")) {
      startTransition(async () => {
        try {
          const { eliminarPago } = await import("@/app/(dashboard)/finanzas/actions");
          await eliminarPago(id);
        } catch (err) {
          console.error("Error al eliminar pago:", err);
        }
      });
    }
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
    <>
      {/* ===== MOBILE: Card Layout ===== */}
      <div className="space-y-3 md:hidden">
        {pagos.map((pago) => {
          const config = ESTADO_PAGO_CONFIG[pago.estado];
          const nombreAlumno = pago.alumnos
            ? `${pago.alumnos.nombre} ${pago.alumnos.apellido}`
            : "—";
          const fechaStr = formatFechaDiaMes(pago.fecha_pago);

          return (
            <div
              key={pago.id}
              className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Top row: Name + Amount */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-surface-900 truncate">
                    {nombreAlumno}
                  </p>
                  <p className="text-xs text-surface-400 mt-1">{fechaStr}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <p className="text-lg font-black text-surface-900">
                    {formatearMonto(pago.monto)}
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${config.bg} ${config.color}`}
                  >
                    {config.label}
                  </span>
                </div>
              </div>

              {/* Actions row */}
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-surface-100">
                {pago.estado === "pendiente" && (
                  <>
                    <ConfirmarPagoModal
                      pago={{
                        id: pago.id,
                        alumno_id: pago.alumno_id,
                        monto: pago.monto,
                        estado: pago.estado,
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-success-500 px-3 py-3 min-h-11 text-xs font-bold text-white shadow-sm hover:bg-success-400 transition-all active:scale-95 disabled:opacity-50"
                    />
                    {(() => {
                      const contacto = contactoDePago(pago);
                      return (
                        <a
                          href={generarLinkWhatsApp(
                            contacto.telefono ?? "",
                            recordatorioPago({
                              nombreMaestra,
                              alumno: {
                                nombre: pago.alumnos?.nombre ?? "Alumno",
                                apellido: pago.alumnos?.apellido ?? "",
                              },
                              monto: pago.monto,
                              template: templateRecordatorio,
                              datos_pago: datosPago,
                            })
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-100 text-surface-600 hover:bg-surface-200 transition-colors"
                          title="Enviar recordatorio"
                          aria-label="Enviar recordatorio por WhatsApp"
                        >
                          <MessageSquare size={18} />
                        </a>
                      );
                    })()}
                  </>
                )}
                {pago.estado === "pagado" && (
                  <span className="flex items-center gap-1 text-xs text-surface-400 italic flex-1">
                    <Check size={14} /> Cobrado
                  </span>
                )}
                <EditarCobroModal
                  pago={{
                    id: pago.id,
                    monto: pago.monto,
                    estado: pago.estado,
                    fecha_pago: pago.fecha_pago,
                    nota: pago.nota,
                    periodo: pago.periodo,
                  }}
                />
                <button
                  onClick={() => handleEliminar(pago.id)}
                  disabled={isPending}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-surface-400 hover:bg-danger-50 hover:text-danger-500 transition-colors disabled:opacity-50"
                  title="Eliminar"
                  aria-label="Eliminar cobro"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== DESKTOP: Table Layout ===== */}
      <div className="hidden md:block rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
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
                      {formatFechaDiaMes(pago.fecha_pago)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {pago.estado === "pendiente" && (
                          <>
                            {(() => {
                              const contacto = contactoDePago(pago);
                              return (
                                <a
                                  href={generarLinkWhatsApp(
                                    contacto.telefono ?? "",
                                    recordatorioPago({
                                      nombreMaestra,
                                      alumno: {
                                        nombre: pago.alumnos?.nombre ?? "Alumno",
                                        apellido: pago.alumnos?.apellido ?? "",
                                      },
                                      monto: pago.monto,
                                      template: templateRecordatorio,
                                      datos_pago: datosPago,
                                    })
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-lg bg-surface-100 p-2 text-surface-600 hover:bg-surface-200 transition-colors"
                                  title="Enviar recordatorio por WhatsApp"
                                >
                                  <MessageSquare size={16} />
                                </a>
                              );
                            })()}
                            <ConfirmarPagoModal
                              pago={{
                                id: pago.id,
                                alumno_id: pago.alumno_id,
                                monto: pago.monto,
                                estado: pago.estado,
                              }}
                              className="flex items-center gap-1.5 rounded-lg bg-success-500 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm hover:bg-success-400 transition-all active:scale-95 disabled:opacity-50"
                              trigger={<>Marcar Pagado</>}
                            />
                          </>
                        )}
                        {pago.estado === "pagado" && (
                          <span className="flex items-center gap-1 text-xs text-surface-400 italic">
                            Cobrado <Check size={14} />
                          </span>
                        )}
                        <EditarCobroModal
                          pago={{
                            id: pago.id,
                            monto: pago.monto,
                            estado: pago.estado,
                            fecha_pago: pago.fecha_pago,
                            nota: pago.nota,
                            periodo: pago.periodo,
                          }}
                        />
                        <button
                          onClick={() => handleEliminar(pago.id)}
                          disabled={isPending}
                          className="rounded-lg p-2 text-surface-400 hover:bg-danger-50 hover:text-danger-500 transition-colors disabled:opacity-50 ml-2"
                          title="Eliminar cobro"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
