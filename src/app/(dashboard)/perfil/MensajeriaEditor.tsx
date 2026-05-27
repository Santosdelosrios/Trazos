"use client";

import { useState, useTransition, useMemo } from "react";
import { MessageSquare, Save, RotateCcw, Eye } from "lucide-react";
import { setMensajeria } from "./actions";
import {
  renderTemplate,
  buildVars,
  TEMPLATE_DEFAULT,
  VARIABLES_TEMPLATE,
} from "@/lib/finanzas/templateWhatsApp";

interface Props {
  datosPagoIniciales: string | null;
  templateInicial: string | null;
}

/**
 * Editor de la mensajería de WhatsApp en /perfil:
 *  - Datos de pago (textarea libre)
 *  - Template del recordatorio con preview en vivo
 *
 * Si el template queda vacío, la app cae al TEMPLATE_DEFAULT. Eso se
 * muestra como hint, no hay que blanquear con SQL.
 */
export default function MensajeriaEditor({ datosPagoIniciales, templateInicial }: Props) {
  const [datosPago, setDatosPago] = useState(datosPagoIniciales ?? "");
  const [template, setTemplate] = useState(templateInicial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Preview: usa data demo, no datos reales (para no exponer alumnos).
  const preview = useMemo(() => {
    const efectivo = template.trim() || TEMPLATE_DEFAULT;
    const vars = buildVars({
      nombre_alumno: "Sofía Pérez",
      nombre_responsable: "Mariana",
      fecha_referencia: new Date(),
      clases: [
        { fecha: "2026-05-08", tema: "Matemática", monto: 5000 },
        { fecha: "2026-05-15", tema: "Matemática", monto: 5000 },
        { fecha: "2026-05-22", tema: "Lengua", monto: 5000 },
      ],
      monto: 15000,
      datos_pago: datosPago.trim() || "Alias: trazos.demo · CBU: 0000000000000000000000",
      miembros_familia: [
        { nombre_completo: "Sofía Pérez", subtotal: 10000, clases: 2 },
        { nombre_completo: "Tomás Pérez", subtotal: 5000, clases: 1 },
      ],
    });
    return renderTemplate(efectivo, vars);
  }, [template, datosPago]);

  const usandoDefault = !template.trim();

  function handleGuardar() {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      try {
        await setMensajeria({
          datos_pago: datosPago.trim() || null,
          template_recordatorio: template.trim() || null,
        });
        setOkMsg("Guardado");
        setTimeout(() => setOkMsg(null), 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  function handleResetTemplate() {
    setTemplate(TEMPLATE_DEFAULT);
  }

  return (
    <div className="rounded-2xl bg-white border border-surface-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-100 bg-surface-50/50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
          <MessageSquare size={16} className="text-emerald-600" />
          Mensajería (WhatsApp)
        </h3>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <p className="rounded-lg bg-danger-50 border border-danger-200 px-3 py-2 text-xs font-semibold text-danger-700">
            {error}
          </p>
        )}
        {okMsg && (
          <p className="rounded-lg bg-success-50 border border-success-200 px-3 py-2 text-xs font-semibold text-success-700">
            {okMsg}
          </p>
        )}

        {/* Datos de pago */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-1">
            Datos de pago
          </label>
          <p className="text-xs text-surface-500 mb-2">
            Lo que las familias necesitan saber para pagarte: CBU, alias,
            link de Mercado Pago. Se inyecta en la variable <code className="text-[11px] bg-surface-100 px-1 py-0.5 rounded">{"{datos_pago}"}</code> del template.
          </p>
          <textarea
            value={datosPago}
            onChange={(e) => setDatosPago(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={"Ej:\nAlias: maria.profe\nCBU: 0000123456789012345678\nMercado Pago: link.mercadopago.com.ar/..."}
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm font-medium focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"
          />
          <p className="mt-1 text-[10px] text-surface-400 text-right">
            {datosPago.length} / 500
          </p>
        </div>

        {/* Template */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-surface-500">
              Template del recordatorio
            </label>
            {!usandoDefault && (
              <button
                type="button"
                onClick={handleResetTemplate}
                className="flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:underline"
              >
                <RotateCcw size={11} /> Volver al default
              </button>
            )}
          </div>
          <p className="text-xs text-surface-500 mb-2">
            Variables disponibles (click para copiar):
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {VARIABLES_TEMPLATE.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(`{${v}}`);
                  setTemplate((t) => t + `{${v}}`);
                }}
                className="rounded-md bg-surface-100 px-2 py-0.5 text-[10px] font-mono text-surface-700 hover:bg-primary-100 hover:text-primary-700 transition-colors"
                title="Insertar variable"
              >
                {`{${v}}`}
              </button>
            ))}
          </div>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={9}
            maxLength={2000}
            placeholder={`Si dejás vacío usamos el default:\n\n${TEMPLATE_DEFAULT}`}
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm font-medium focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none font-mono leading-relaxed"
          />
          <div className="mt-1 flex items-center justify-between text-[10px] text-surface-400">
            <span>{usandoDefault ? "Usando template default" : "Template editado"}</span>
            <span>{template.length} / 2000</span>
          </div>
        </div>

        {/* Preview */}
        <div>
          <p className="block text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-2 flex items-center gap-1">
            <Eye size={11} /> Preview con datos demo
          </p>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-3 text-sm text-surface-800 whitespace-pre-wrap leading-relaxed font-medium">
            {preview || <span className="text-surface-400 italic">El template está vacío.</span>}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-surface-100">
          <button
            type="button"
            onClick={handleGuardar}
            disabled={pending}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 transition-all active:scale-95"
          >
            {pending ? "Guardando…" : <><Save size={14} /> Guardar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
