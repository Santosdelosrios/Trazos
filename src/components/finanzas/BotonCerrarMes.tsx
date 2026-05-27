"use client";

import { useState, useTransition } from "react";
import { FileText, ChevronDown, Loader2, Check } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

interface OpcionMes {
  anio: number;
  mes: number;
  label: string;
  periodo: string; // YYYY-MM
}

/** Genera las últimas N opciones de mes, empezando por el actual. */
function ultimosMeses(cant = 12): OpcionMes[] {
  const hoy = new Date();
  const opts: OpcionMes[] = [];
  for (let i = 0; i < cant; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const anio = d.getFullYear();
    const mes = d.getMonth() + 1;
    opts.push({
      anio, mes,
      label: `${MESES_LARGOS[mes - 1]} ${anio}`,
      periodo: `${anio}-${String(mes).padStart(2, "0")}`,
    });
  }
  return opts;
}

/**
 * Descarga el reporte PDF de un mes. Hace fetch al endpoint, recibe
 * el blob y dispara un download nativo.
 */
export default function BotonCerrarMes() {
  const [abierto, setAbierto] = useState(false);
  const [descargando, startDescarga] = useTransition();
  const [exitoso, setExitoso] = useState<string | null>(null);
  const toast = useToast();
  const opciones = ultimosMeses(12);

  function handleDescargar(opt: OpcionMes) {
    setExitoso(null);
    startDescarga(async () => {
      try {
        const res = await fetch(`/api/reporte-mes/${opt.periodo}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(await res.text() || "No se pudo generar el reporte");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `reporte-${opt.periodo}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExitoso(opt.periodo);
        setAbierto(false);
        toast.success(`Reporte de ${opt.label} descargado`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al descargar";
        toast.error(msg);
      }
    });
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        disabled={descargando}
        className="flex items-center gap-2 rounded-xl bg-surface-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-all"
      >
        {descargando ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <FileText size={14} />
        )}
        Cerrar mes
        <ChevronDown size={12} className={`transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-surface-200 bg-white shadow-xl overflow-hidden animate-fade-in-up">
            <div className="px-3 py-2 border-b border-surface-100 bg-surface-50/60">
              <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500">
                Descargar reporte de…
              </p>
            </div>
            <ul className="max-h-72 overflow-y-auto">
              {opciones.map((opt) => (
                <li key={opt.periodo}>
                  <button
                    type="button"
                    onClick={() => handleDescargar(opt)}
                    disabled={descargando}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-surface-700 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-50 transition-colors capitalize"
                  >
                    <span>{opt.label}</span>
                    {exitoso === opt.periodo && <Check size={12} className="text-success-500" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
