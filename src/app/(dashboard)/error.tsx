"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Acá en el futuro podrías enviar el error a Sentry o similar
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in-up">
      <div className="w-20 h-20 bg-danger-50 text-danger-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm rotate-[-3deg]">
        <AlertTriangle size={40} />
      </div>
      
      <h1 className="text-3xl font-extrabold text-surface-900 mb-4 trazos-heading">
        ¡Uy! Se nos traspapeló algo.
      </h1>
      
      <p className="text-surface-600 max-w-md mx-auto mb-8 text-lg">
        Hubo un problema al cargar esta información. Puede ser un error de conexión o que nuestros servidores estén tomando un mate.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => reset()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-surface-900 text-white rounded-xl font-bold hover:bg-surface-800 transition-colors shadow-sm active:scale-95"
        >
          <RefreshCcw size={18} />
          Intentar de nuevo
        </button>
        
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-surface-200 text-surface-700 rounded-xl font-bold hover:bg-surface-50 hover:border-surface-300 transition-colors active:scale-95"
        >
          <Home size={18} />
          Volver al Inicio
        </Link>
      </div>

      <div className="mt-12 p-4 bg-surface-100 rounded-lg border border-surface-200 text-left max-w-md w-full overflow-hidden">
        <p className="text-xs font-bold text-surface-500 mb-1 uppercase tracking-wider">Detalle técnico (para el soporte):</p>
        <p className="text-xs text-surface-600 font-mono break-words">
          {error.message || "Error desconocido"}
        </p>
      </div>
    </div>
  );
}
