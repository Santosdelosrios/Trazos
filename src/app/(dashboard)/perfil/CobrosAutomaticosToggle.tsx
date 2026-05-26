"use client";

import { useState, useTransition } from "react";
import { Zap, Check, X } from "lucide-react";
import { setCobrosAutomaticos } from "./actions";

interface Props {
  inicial: boolean;
}

/**
 * Toggle del feature flag de cobros automáticos al cerrar clase.
 * Por defecto las maestras "beta" (creadas antes de PR-2) tienen
 * este flag en false para preservar su comportamiento anterior; la UI
 * las invita a activarlo desde acá.
 */
export default function CobrosAutomaticosToggle({ inicial }: Props) {
  const [activo, setActivo] = useState(inicial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const proximoValor = !activo;
    setError(null);
    setActivo(proximoValor); // optimistic
    startTransition(async () => {
      try {
        await setCobrosAutomaticos(proximoValor);
      } catch (err) {
        setActivo(!proximoValor); // rollback
        setError(err instanceof Error ? err.message : "No se pudo actualizar.");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white border border-surface-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-100 bg-surface-50/50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
          <Zap size={16} className={activo ? "text-primary-600" : "text-surface-400"} />
          Cobros automáticos al cerrar clase
        </h3>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-sm text-surface-600 leading-relaxed">
          Cuando esto está activo, al cerrar una clase Trazos genera el
          cobro pendiente automáticamente según el modelo de cobro del
          alumno (clase suelta, cuenta corriente, descuento de la bolsa
          o excedente del abono mensual). Si lo desactivás, vas a tener
          que cargar cada cobro a mano desde Cobranzas.
        </p>

        <div className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50/40 px-4 py-3">
          <div className="flex items-center gap-2">
            {activo ? (
              <Check size={16} className="text-success-500" />
            ) : (
              <X size={16} className="text-surface-400" />
            )}
            <p className="text-sm font-semibold text-surface-900">
              {activo ? "Activado" : "Desactivado"}
            </p>
          </div>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            role="switch"
            aria-checked={activo}
            aria-label="Activar o desactivar cobros automáticos"
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              activo ? "bg-primary-600" : "bg-surface-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                activo ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {error && (
          <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs font-semibold text-danger-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
