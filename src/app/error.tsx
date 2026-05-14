"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-surface-50">
      <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
        <AlertCircle size={32} />
      </div>
      
      <h1 className="text-3xl font-bold text-surface-900 mb-4">
        Algo salió mal
      </h1>
      
      <p className="text-surface-600 max-w-md mx-auto mb-8">
        Hubo un error inesperado en la aplicación. Podés intentar recargar la página o volver al inicio.
      </p>

      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-2 bg-surface-900 text-white rounded-lg font-medium hover:bg-surface-800 transition-colors"
        >
          Recargar
        </button>
        <Link
          href="/"
          className="px-6 py-2 bg-white border border-surface-200 text-surface-700 rounded-lg font-medium hover:bg-surface-50 transition-colors"
        >
          Ir al Inicio
        </Link>
      </div>
    </div>
  );
}
