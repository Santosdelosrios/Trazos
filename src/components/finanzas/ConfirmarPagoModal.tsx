"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import {
  CheckCircle2, X, Upload, FileText, Trash2,
  AlertCircle, ChevronDown, ChevronUp, Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { confirmarPago } from "@/app/(dashboard)/finanzas/actions";
import { subirComprobante, validarArchivoComprobante } from "@/lib/finanzas/comprobantes";
import { armarImputacionFIFO, type ClasePendienteImputacion, type LineaImputacion } from "@/lib/finanzas/imputacion";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import { useToast } from "@/components/ui/Toast";
import type { MedioPago, EstadoPago, Pago } from "@/lib/types/database";
import { MEDIO_PAGO_LABELS } from "@/lib/types/database";

interface Props {
  pago: Pick<Pago, "id" | "alumno_id" | "monto" | "estado">;
  trigger?: React.ReactNode;
  className?: string;
}

const MEDIOS: MedioPago[] = ["efectivo", "transferencia", "mercadopago", "otro"];

/**
 * Modal de confirmación de un cobro. Reemplaza el click directo
 * "Marcar Pagado". Soporta:
 *   - Medio de pago (required)
 *   - Fecha (default hoy)
 *   - Comprobante (opcional, subida al bucket comprobantes-pagos)
 *   - Nota
 *   - Imputación FIFO si el monto < saldo total (panel expandible)
 */
export default function ConfirmarPagoModal({ pago, trigger, className }: Props) {
  const [open, setOpen] = useState(false);
  const [monto, setMonto] = useState<number>(Number(pago.monto));
  const [medio, setMedio] = useState<MedioPago>("efectivo");
  const [fecha, setFecha] = useState<string>(new Date().toISOString().slice(0, 10));
  const [nota, setNota] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [pendientes, setPendientes] = useState<ClasePendienteImputacion[]>([]);
  /** Override manual del reparto. null = usar FIFO derivado del monto. */
  const [imputacionesOverride, setImputacionesOverride] = useState<LineaImputacion[] | null>(null);
  const [mostrarImputacion, setMostrarImputacion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  // Cargar clases pendientes al abrir
  useEffect(() => {
    if (!open) return;
    const supa = createClient();
    supa
      .rpc("clases_pendientes_imputacion", { p_alumno_id: pago.alumno_id })
      .then(({ data }) => {
        setPendientes((data as ClasePendienteImputacion[]) ?? []);
      });
  }, [open, pago.alumno_id]);

  // Imputaciones derivadas: si la maestra editó manualmente, usamos
  // su override; si no, FIFO sobre el monto actual. Esto evita el
  // antipatrón setState-in-effect.
  const imputaciones = useMemo<LineaImputacion[]>(() => {
    if (imputacionesOverride) return imputacionesOverride;
    return armarImputacionFIFO(pendientes, monto).lineas;
  }, [imputacionesOverride, pendientes, monto]);

  const estadoSugerido: EstadoPago = monto >= Number(pago.monto) ? "pagado" : "parcial";
  const sumaImputado = imputaciones.reduce((acc, l) => acc + l.monto_imputado, 0);
  const saldoAFavor = Math.max(0, monto - sumaImputado);
  const totalPendiente = pendientes.reduce((acc, c) => acc + c.pendiente, 0);

  function reset() {
    setMonto(Number(pago.monto));
    setMedio("efectivo");
    setFecha(new Date().toISOString().slice(0, 10));
    setNota("");
    setArchivo(null);
    setImputacionesOverride(null);
    setMostrarImputacion(false);
    setError(null);
    setOpen(false);
  }

  function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setArchivo(null);
      return;
    }
    try {
      validarArchivoComprobante(f);
      setArchivo(f);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archivo no válido.");
      e.target.value = "";
    }
  }

  function handleEditarImputacion(claseId: string, nuevoMonto: number) {
    // Al editar, fijamos el override (deja de derivarse del monto)
    setImputacionesOverride((prev) => {
      const base = prev ?? imputaciones;
      const otros = base.filter((l) => l.clase_id !== claseId);
      if (nuevoMonto > 0) {
        return [...otros, { clase_id: claseId, monto_imputado: nuevoMonto }];
      }
      return otros;
    });
  }

  async function handleSubmit() {
    setError(null);
    if (monto <= 0) {
      setError("El monto del cobro debe ser mayor a 0.");
      return;
    }
    startTransition(async () => {
      try {
        const supa = createClient();
        // 1. Subir comprobante (si hay)
        let comprobantePath: string | undefined;
        if (archivo) {
          const { data: { user } } = await supa.auth.getUser();
          if (!user) throw new Error("Sesión expirada.");
          const res = await subirComprobante(supa, {
            maestraId: user.id,
            pagoId: pago.id,
            archivo,
          });
          comprobantePath = res.path;
        }
        // 2. Confirmar
        await confirmarPago({
          pago_id: pago.id,
          monto,
          estado: estadoSugerido,
          medio_pago: medio,
          fecha_pago: fecha,
          comprobante_url: comprobantePath ?? null,
          nota: nota || null,
          imputaciones: imputaciones.length > 0 ? imputaciones : undefined,
        });
        toast.success(
          estadoSugerido === "pagado"
            ? `Cobro confirmado por ${formatearMonto(monto)}`
            : `Pago parcial registrado por ${formatearMonto(monto)}`
        );
        reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo confirmar.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "flex items-center gap-1.5 rounded-xl bg-success-500 px-3 py-3 min-h-11 text-xs font-bold text-white shadow-sm hover:bg-success-400 transition-all active:scale-95"
        }
      >
        {trigger ?? <><CheckCircle2 size={14} /> Marcar Pagado</>}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-surface-900/40 backdrop-blur-sm animate-fade-in-up">
      <div className="absolute inset-0" onClick={reset} />
      <div className="relative w-full sm:max-w-lg max-h-[95vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white border border-surface-200 shadow-2xl z-10">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-surface-100 px-5 py-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-success-500" /> Confirmar cobro
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

        <div className="p-5 space-y-5">
          {error && (
            <div className="rounded-xl bg-danger-50 border border-danger-200 px-3 py-2 text-xs font-semibold text-danger-700 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Monto */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-1">
              Monto cobrado
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-surface-400">$</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                value={monto}
                onChange={(e) => setMonto(Number(e.target.value))}
                className="w-full rounded-xl border border-surface-200 bg-surface-50 pl-8 pr-4 py-3 text-base font-bold focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <span className="text-surface-500">
                Monto original: <strong>{formatearMonto(Number(pago.monto))}</strong>
              </span>
              {estadoSugerido === "parcial" && (
                <span className="rounded-md bg-accent-50 text-accent-700 px-1.5 py-0.5 font-bold">Parcial</span>
              )}
            </div>
          </div>

          {/* Medio de pago */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-2">
              Medio de pago <span className="text-danger-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {MEDIOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMedio(m)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-bold text-left transition-all ${
                    medio === m
                      ? "border-primary-400 bg-primary-50 text-primary-700 ring-2 ring-primary-200"
                      : "border-surface-200 bg-white text-surface-700 hover:border-surface-300"
                  }`}
                >
                  {MEDIO_PAGO_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha + Nota en grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-1">
                <Calendar size={11} className="inline mr-1" /> Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
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
                placeholder="Opcional"
                className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
          </div>

          {/* Comprobante */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-1">
              Comprobante <span className="font-normal normal-case text-surface-400">(opcional, máx 5 MB)</span>
            </label>
            {archivo ? (
              <div className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="text-primary-600 shrink-0" />
                  <span className="text-xs font-semibold text-surface-700 truncate">{archivo.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setArchivo(null)}
                  className="rounded-lg p-1 text-surface-400 hover:bg-danger-50 hover:text-danger-500"
                  aria-label="Quitar archivo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-surface-200 bg-surface-50/40 px-3 py-4 text-xs text-surface-500 cursor-pointer hover:border-primary-300 hover:bg-primary-50/40">
                <Upload size={18} className="text-surface-400" />
                <span><strong className="text-primary-600">Subir archivo</strong> · JPG, PNG o PDF</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleArchivo}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Imputación a clases (collapsible) */}
          {pendientes.length > 0 && (
            <div className="rounded-xl border border-surface-200 bg-surface-50/40">
              <button
                type="button"
                onClick={() => setMostrarImputacion((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div>
                  <p className="text-xs font-bold text-surface-900">
                    Imputar a clases específicas
                  </p>
                  <p className="text-[10px] text-surface-500 mt-0.5">
                    {sumaImputado === monto
                      ? `Imputado a ${imputaciones.length} clase${imputaciones.length === 1 ? "" : "s"} (FIFO)`
                      : `${formatearMonto(sumaImputado)} de ${formatearMonto(monto)} imputado · ${formatearMonto(saldoAFavor)} a favor`}
                  </p>
                </div>
                {mostrarImputacion ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {mostrarImputacion && (
                <div className="border-t border-surface-200 p-3 space-y-2">
                  <p className="text-[10px] text-surface-500">
                    Total pendiente del alumno: <strong>{formatearMonto(totalPendiente)}</strong>.
                    Por defecto cubrimos las clases más viejas primero (FIFO). Podés editar.
                  </p>
                  {pendientes.map((c) => {
                    const linea = imputaciones.find((l) => l.clase_id === c.clase_id);
                    const valor = linea?.monto_imputado ?? 0;
                    return (
                      <div key={c.clase_id} className="flex items-center gap-2 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-surface-900 truncate">{c.tema}</p>
                          <p className="text-[10px] text-surface-400">
                            {new Date(c.fecha).toLocaleDateString("es-AR", { day: "numeric", month: "short" })} · pendiente {formatearMonto(c.pendiente)}
                          </p>
                        </div>
                        <div className="relative w-28 shrink-0">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-surface-400">$</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={c.pendiente}
                            step={100}
                            value={valor || ""}
                            onChange={(e) => handleEditarImputacion(c.clase_id, Number(e.target.value))}
                            className="w-full rounded-lg border border-surface-200 bg-white pl-5 pr-2 py-1.5 text-xs font-semibold text-right focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-200"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-surface-100 px-5 py-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-surface-600 hover:bg-surface-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-success-500 to-success-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:from-success-600 hover:to-success-700 disabled:opacity-50"
          >
            {pending ? "Confirmando…" : <><CheckCircle2 size={16} /> Confirmar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
