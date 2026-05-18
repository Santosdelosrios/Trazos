"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { HitoAprendizaje, EjercicioGenerado, EjercicioResultado, ModeloCobro } from "@/lib/types/database";
import { MODELO_COBRO_CONFIG } from "@/lib/types/database";
import { Target, Bot, Wallet, CheckCircle2, Sparkles, Frown, Meh, Smile, Star, PenTool } from "lucide-react";

interface PasoResumenProps {
  isLoading: boolean;
  hito: HitoAprendizaje | null;
  ejercicios: EjercicioGenerado[];
  resultados: EjercicioResultado[];
  nota: number | null;
  modeloCobro?: ModeloCobro;
  initialMonto?: number;
  initialDuracion?: number;
  onRegistrarCobro?: (monto: number, duracion: number, estado: "pagado" | "pendiente") => Promise<void>;
}

export default function PasoResumen({
  isLoading,
  hito,
  ejercicios,
  resultados,
  nota,
  modeloCobro = "por_clase",
  initialMonto,
  initialDuracion,
  onRegistrarCobro,
}: PasoResumenProps) {
  const [monto, setMonto] = useState<string>(initialMonto?.toString() || "");
  const [duracionReal, setDuracionReal] = useState<number>(initialDuracion || 1);
  const [cobroStatus, setCobroStatus] = useState<"none" | "saving" | "saved">("none");

  const config = MODELO_COBRO_CONFIG[modeloCobro];

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-8 animate-fade-in-up">
        <section className="rounded-2xl border border-surface-200 bg-white p-12 shadow-sm text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-3xl shadow-lg animate-pulse-soft text-white">
            <PenTool size={32} className="animate-wiggle" />
          </div>
          <h2 className="mt-6 text-xl font-bold tracking-tight text-surface-900">
            Analizando resultados...
          </h2>
          <p className="mt-2 text-sm text-surface-700 max-w-md mx-auto">
            Gemini está revisando la respuesta y la autoevaluación para generar el hito de aprendizaje.
          </p>
        </section>
      </div>
    );
  }

  if (!hito || !ejercicios || !resultados || nota === null) {
    return (
      <div className="max-w-2xl text-center text-danger-500">
        Ocurrió un error al cargar el resumen.
      </div>
    );
  }

  const correctas = resultados.filter((r) => r.es_correcta).length;
  const total = ejercicios.length;

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in-up">
      {/* ========================================
          ENCABEZADO DE RESULTADO Y NOTA
          ======================================== */}
      <section className="rounded-2xl border border-surface-200 bg-white p-8 shadow-sm text-center">
        <h2 className="text-xl font-bold tracking-tight text-surface-900 mb-6">
          Desempeño de la clase
        </h2>
        
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          {/* NOTA */}
          <div className="flex flex-col items-center">
            <div className="text-sm font-semibold text-surface-500 uppercase tracking-widest mb-2">Nota</div>
            <div className={cn(
              "flex h-24 w-24 items-center justify-center rounded-3xl text-4xl font-black shadow-lg",
              nota >= 4 ? "bg-gradient-to-br from-success-400 to-success-600 text-white" :
              nota >= 2.5 ? "bg-gradient-to-br from-warning-400 to-warning-600 text-white" :
              "bg-gradient-to-br from-danger-400 to-danger-600 text-white"
            )}>
              {nota}
            </div>
          </div>

          {/* ESTADÍSTICAS */}
          <div className="flex flex-col gap-4 text-left">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-100 text-surface-500">
                <Target size={20} />
              </span>
              <div>
                <p className="text-sm text-surface-600">Ejercicios correctos</p>
                <p className="text-lg font-bold text-surface-900">{correctas} de {total}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-100 text-surface-500">
                {hito.nivel_comprension === "puede_explicarlo" ? <Star size={20} className="text-warning-500 fill-warning-500" /> :
                 hito.nivel_comprension === "lo_entendio" ? <Smile size={20} className="text-success-500" /> :
                 hito.nivel_comprension === "en_proceso" ? <Meh size={20} className="text-warning-500" /> : <Frown size={20} className="text-danger-500" />}
              </span>
              <div>
                <p className="text-sm text-surface-600">Autoevaluación detectada</p>
                <p className="text-lg font-bold text-surface-900 capitalize">{hito.nivel_comprension.replace("_", " ")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          RESUMEN DE IA (HITO)
          ======================================== */}
      <section className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-8 shadow-sm relative overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary-100 opacity-50 blur-2xl" />
        
        <div className="relative">
          <div className="mb-4 flex items-center gap-2">
            <Bot size={20} className="text-primary-600" />
            <h3 className="font-semibold text-primary-900">
              Análisis del Hito de Aprendizaje
            </h3>
          </div>
          
          <p className="text-lg font-medium text-surface-900 leading-relaxed">
            "{hito.resumen_ia}"
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-surface-700 shadow-sm border border-surface-200">
              <span className="h-2 w-2 rounded-full bg-primary-500" />
              Nivel detectado: {hito.nivel_comprension.replace("_", " ")}
            </div>
            
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-surface-700 shadow-sm border border-surface-200">
              <span className="h-2 w-2 rounded-full bg-surface-500" />
              Guardado en base de datos
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          REGISTRO DE COBRO / MOVIMIENTO AUTOMÁTICO
          ======================================== */}
      {modeloCobro === "por_clase" && onRegistrarCobro && (
        <section className="rounded-2xl border border-surface-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Wallet size={20} className="text-surface-700" />
            <h3 className="font-semibold text-surface-900">Registro de Cobro</h3>
          </div>
          
          {cobroStatus === "saved" ? (
            <div className="rounded-xl bg-success-50 p-4 text-center border border-success-200">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-success-500" />
              <p className="text-sm font-bold text-success-700">El pago fue registrado correctamente.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-surface-700 uppercase mb-1.5 block">
                    Duración real (horas)
                  </label>
                  <input
                    type="number" inputMode="numeric" pattern="[0-9]*"
                    min="0.5"
                    step="0.5"
                    value={duracionReal}
                    onChange={(e) => setDuracionReal(Number(e.target.value))}
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-surface-700 uppercase mb-1.5 block">
                    Monto a cobrar (ARS)
                  </label>
                  <input
                    type="number" inputMode="numeric" pattern="[0-9]*"
                    min="0"
                    step="100"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="Ej: 5000"
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  disabled={!monto || cobroStatus === "saving"}
                  onClick={async () => {
                    setCobroStatus("saving");
                    try {
                      await onRegistrarCobro(Number(monto), duracionReal, "pendiente");
                      setCobroStatus("saved");
                    } catch {
                      setCobroStatus("none");
                    }
                  }}
                  className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-2.5 text-sm font-bold text-warning-700 hover:bg-warning-100 transition-colors disabled:opacity-50"
                >
                  Queda Pendiente
                </button>
                <button
                  disabled={!monto || cobroStatus === "saving"}
                  onClick={async () => {
                    setCobroStatus("saving");
                    try {
                      await onRegistrarCobro(Number(monto), duracionReal, "pagado");
                      setCobroStatus("saved");
                    } catch {
                      setCobroStatus("none");
                    }
                  }}
                  className="rounded-xl border border-success-200 bg-success-50 px-4 py-2.5 text-sm font-bold text-success-700 hover:bg-success-100 transition-colors disabled:opacity-50"
                >
                  Ya me pagaron
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {modeloCobro !== "por_clase" && (
        <section className="rounded-2xl border border-surface-200 bg-white p-8 shadow-sm space-y-4 text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-100 text-xl">
              {config.icon}
            </span>
            <div>
              <h3 className="font-bold text-surface-900">{config.label}</h3>
              <p className="text-xs text-surface-500">{config.descripcion}</p>
            </div>
          </div>
          
          <div className="rounded-xl bg-success-50 p-4 border border-success-200 text-xs text-success-800 flex items-center gap-3 font-medium">
            <CheckCircle2 size={20} className="text-success-500 flex-shrink-0" />
            <div>
              <p className="font-bold">Movimiento registrado automáticamente</p>
              <p className="mt-0.5 text-success-700">
                {modeloCobro === "bolsa_creditos"
                  ? "Se descontó 1 clase de la bolsa de créditos del alumno."
                  : modeloCobro === "abono_mensual"
                  ? "El alumno tiene un abono fijo mensual vigente."
                  : "Se registró el valor de la clase en la cuenta corriente del alumno."}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ========================================
          BOTONES DE ACCIÓN
          ======================================== */}
      <div className="flex items-center gap-4 pt-4">
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl border border-surface-200 bg-white px-5 py-2.5 text-sm font-semibold text-surface-700 shadow-sm transition-all hover:bg-surface-50 hover:text-surface-900 active:scale-95"
        >
          <Sparkles size={16} /> Evaluar otro alumno
        </button>
        <a
          href="/dashboard"
          className="flex-1 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2.5 text-center text-sm font-semibold text-white shadow-md transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-lg active:scale-[0.98]"
        >
          Ir al Inicio
        </a>
      </div>
    </div>
  );
}
