"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Calendar, Sparkles, X, CheckCircle2 } from "lucide-react";

export default function TutorialPrimerosPasos() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-50 to-primary-100 border-2 border-primary-200 p-6 shadow-sm mb-8 animate-fade-in-up">
      {/* Decorative notebook elements */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-white rounded-full opacity-40 blur-2xl"></div>
      <div className="trazos-tape !left-6 !top-[-6px] !w-24 !bg-primary-300"></div>
      
      <button 
        onClick={() => setIsVisible(false)}
        className="absolute top-4 right-4 text-primary-400 hover:text-primary-700 transition-colors"
        aria-label="Cerrar tutorial"
      >
        <X size={20} />
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary-600 text-white p-2 rounded-xl shadow-sm rotate-[-3deg]">
          <Sparkles size={24} />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-surface-900 tracking-tight">¡Bienvenida a Trazos! 👋</h2>
          <p className="text-sm font-medium text-surface-600">Completá estos 3 pasos para poner en marcha tu cuaderno digital.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Paso 1 */}
        <Link href="/alumnos" className="group relative bg-white rounded-xl p-4 border border-surface-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all rotate-[-1deg]">
          <div className="flex justify-between items-start mb-2">
            <div className="bg-accent-100 text-accent-700 w-8 h-8 rounded-lg flex items-center justify-center font-black">1</div>
            <GraduationCap className="text-surface-300 group-hover:text-accent-500 transition-colors" size={20} />
          </div>
          <h3 className="font-bold text-surface-900">Agregá tu primer alumno</h3>
          <p className="text-xs text-surface-500 mt-1">Armá su ficha para llevar el seguimiento de sus clases y pagos.</p>
        </Link>

        {/* Paso 2 */}
        <Link href="/agenda" className="group relative bg-white rounded-xl p-4 border border-surface-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all rotate-[1deg]">
          <div className="flex justify-between items-start mb-2">
            <div className="bg-primary-100 text-primary-700 w-8 h-8 rounded-lg flex items-center justify-center font-black">2</div>
            <Calendar className="text-surface-300 group-hover:text-primary-500 transition-colors" size={20} />
          </div>
          <h3 className="font-bold text-surface-900">Agendá una clase</h3>
          <p className="text-xs text-surface-500 mt-1">Planificá qué día y a qué hora le vas a dar clases.</p>
        </Link>

        {/* Paso 3 */}
        <Link href="/clases" className="group relative bg-white rounded-xl p-4 border border-surface-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all rotate-[-1deg]">
          <div className="flex justify-between items-start mb-2">
            <div className="bg-success-100 text-success-700 w-8 h-8 rounded-lg flex items-center justify-center font-black">3</div>
            <CheckCircle2 className="text-surface-300 group-hover:text-success-500 transition-colors" size={20} />
          </div>
          <h3 className="font-bold text-surface-900">Cerrá la clase con IA</h3>
          <p className="text-xs text-surface-500 mt-1">Completá la clase y dejá que Trazos te arme los ejercicios de tarea.</p>
        </Link>
      </div>
    </div>
  );
}
