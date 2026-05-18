"use client";

import Link from "next/link";
import { GraduationCap, Calendar, Sparkles, BookOpen, ArrowRight } from "lucide-react";

export default function TutorialPrimerosPasos({ nombreMaestra = "Profe" }: { nombreMaestra?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 animate-fade-in-up">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white border border-surface-200 shadow-xl p-8 md:p-12 text-center">
        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent-100 rounded-full blur-3xl opacity-50"></div>
        <div className="trazos-tape !left-1/2 !-translate-x-1/2 !top-[-10px] !w-32 !bg-primary-300"></div>
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg rotate-[-3deg] animate-pulse-subtle">
            <Sparkles size={40} />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-extrabold text-surface-900 tracking-tight mb-4">
            ¡Te damos la bienvenida a Trazos, {nombreMaestra}! 👋
          </h2>
          
          <p className="text-lg text-surface-600 max-w-lg mx-auto mb-10 leading-relaxed">
            Sabemos que dar clases particulares puede ser un caos administrativo. Trazos es tu nuevo <span className="font-bold text-primary-600">cuaderno en limpio</span> para gestionar a tus alumnos, agenda y pagos sin estrés.
          </p>

          <div className="w-full bg-surface-50 rounded-2xl p-6 border border-surface-200 mb-10">
            <h3 className="text-sm font-black uppercase tracking-widest text-surface-400 mb-6">Tus primeros pasos</h3>
            
            <div className="flex flex-col md:flex-row gap-4 items-center justify-center text-left">
              {/* Paso 1 */}
              <div className="flex-1 w-full bg-white rounded-xl p-4 border border-surface-200 shadow-sm relative rotate-[-1deg]">
                <div className="absolute -top-3 -left-3 bg-accent-100 text-accent-700 w-8 h-8 rounded-full flex items-center justify-center font-black border-2 border-white shadow-sm">1</div>
                <div className="flex items-center gap-3 mb-2">
                  <GraduationCap className="text-accent-500" size={20} />
                  <h4 className="font-bold text-surface-900">Creá un alumno</h4>
                </div>
                <p className="text-xs text-surface-500">Armá su ficha para poder agendarle clases y llevar sus pagos.</p>
              </div>

              <div className="hidden md:block text-surface-300">
                <ArrowRight size={24} />
              </div>

              {/* Paso 2 */}
              <div className="flex-1 w-full bg-white rounded-xl p-4 border border-surface-200 shadow-sm relative rotate-[1deg] opacity-50">
                <div className="absolute -top-3 -left-3 bg-surface-100 text-surface-400 w-8 h-8 rounded-full flex items-center justify-center font-black border-2 border-white shadow-sm">2</div>
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="text-surface-400" size={20} />
                  <h4 className="font-bold text-surface-900">Agendá tu clase</h4>
                </div>
                <p className="text-xs text-surface-500">Planificá cuándo le vas a dar clases y dejá que Tiza te ayude.</p>
              </div>
            </div>
          </div>

          <Link 
            href="/alumnos" 
            className="group relative inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:from-primary-700 hover:to-primary-800 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98]"
          >
            <GraduationCap size={24} className="transition-transform group-hover:scale-110 group-hover:rotate-[-10deg]" />
            Crear mi primer alumno
          </Link>
          <p className="mt-4 text-xs text-surface-400">
            Solo te tomará 1 minuto y podrás empezar a usar la agenda.
          </p>
        </div>
      </div>
    </div>
  );
}
