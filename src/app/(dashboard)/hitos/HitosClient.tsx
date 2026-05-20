"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Star, Trophy } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

interface HitoItem {
  id: string;
  nivel_comprension: string;
  resumen_ia: string;
  created_at: string;
  clase_alumnos: {
    clases: {
      tema: string;
    };
    alumnos: {
      id: string;
      nombre: string;
      apellido: string;
    };
  };
}

interface HitosClientProps {
  data: HitoItem[];
  alumnos: { id: string, nombre: string, apellido: string }[];
}

export default function HitosClient({ data, alumnos }: HitosClientProps) {
  const [alumnoFilter, setAlumnoFilter] = useState<string>("todos");
  const [nivelFilter, setNivelFilter] = useState<string>("todos");

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesAlumno = alumnoFilter === "todos" || item.clase_alumnos.alumnos.id === alumnoFilter;
      const matchesNivel = nivelFilter === "todos" || item.nivel_comprension === nivelFilter;
      return matchesAlumno && matchesNivel;
    });
  }, [data, alumnoFilter, nivelFilter]);

  const getNivelLabel = (nivel: string) => {
    switch (nivel) {
      case "lo_entendio": return { label: "Lo entendió", color: "bg-success-100 text-success-700 border-success-200" };
      case "le_costo": return { label: "Le costó", color: "bg-warning-100 text-warning-800 border-warning-200" };
      case "no_lo_entendio": return { label: "No lo entendió", color: "bg-danger-100 text-danger-700 border-danger-200" };
      default: return { label: nivel, color: "bg-surface-100 text-surface-700 border-surface-200" };
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-900">
            Hitos de Aprendizaje
          </h1>
          <p className="mt-1 text-sm text-surface-700">
            Resúmenes cualitativos generados por IA sobre el progreso real.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-4 rounded-2xl border border-surface-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-bold uppercase text-surface-400 px-1">Alumno</label>
          <select
            value={alumnoFilter}
            onChange={(e) => setAlumnoFilter(e.target.value)}
            className="w-full rounded-xl border border-surface-100 bg-surface-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="todos">Todos los alumnos</option>
            {alumnos.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>
            ))}
          </select>
        </div>
        
        <div className="flex-1 space-y-1">
          <label className="text-[10px] font-bold uppercase text-surface-400 px-1">Nivel</label>
          <select
            value={nivelFilter}
            onChange={(e) => setNivelFilter(e.target.value)}
            className="w-full rounded-xl border border-surface-100 bg-surface-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="todos">Todos los niveles</option>
            <option value="lo_entendio">Lo entendió</option>
            <option value="le_costo">Le costó</option>
            <option value="no_lo_entendio">No lo entendió</option>
          </select>
        </div>
      </div>

      {/* Timeline Feed */}
      <div className="relative space-y-8 before:absolute before:left-6 before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-surface-100">
        {filteredData.length === 0 ? (
          <div className="ml-12 rounded-2xl border border-dashed border-surface-300">
            <EmptyState
              icon={Trophy}
              title="No hay hitos que coincidan"
              description="Probá cambiar los filtros, o cerrá una clase para registrar el primer hito de aprendizaje."
            />
          </div>
        ) : (
          filteredData.map((hito) => {
            const info = getNivelLabel(hito.nivel_comprension);
            const date = new Date(hito.created_at);
            return (
              <div key={hito.id} className="relative pl-14">
                {/* Dot icon */}
                <div className="absolute left-3 top-0 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-primary-500 shadow-sm">
                  <Star size={10} className="text-white fill-white" />
                </div>
                
                <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
                  {/* Header de la tarjeta */}
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-100 text-lg font-bold text-surface-600">
                        {hito.clase_alumnos.alumnos.nombre.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-surface-900 leading-none">
                          {hito.clase_alumnos.alumnos.nombre} {hito.clase_alumnos.alumnos.apellido}
                        </h3>
                        <p className="mt-1 flex items-center gap-2 text-xs text-surface-500">
                          {hito.clase_alumnos.clases.tema}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <span className={cn("rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-tight", info.color)}>
                        {info.label}
                      </span>
                      <span suppressHydrationWarning className="text-[10px] font-medium text-surface-400">
                        {date.toLocaleDateString("es-AR", { day: 'numeric', month: 'long' })}
                      </span>
                    </div>
                  </div>

                  {/* Cuerpo: Resumen IA */}
                  <div className="relative rounded-xl bg-surface-50/50 p-4 border border-surface-100">
                    <span className="absolute -top-3 left-4 bg-white px-2 text-[10px] font-bold uppercase text-primary-500 tracking-widest">
                      Análisis cualitativo
                    </span>
                    <p className="text-sm leading-relaxed text-surface-700 italic">
                      "{hito.resumen_ia}"
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
