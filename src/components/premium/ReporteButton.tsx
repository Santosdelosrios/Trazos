"use client";

import { useState } from "react";
import { FileDown, Printer, ArrowLeft, Sparkles, Crown, BookOpen } from "lucide-react";

interface ReporteData {
  alumno: { nombre: string; apellido: string; grado: number };
  maestra: string;
  fecha: string;
  stats: {
    totalClases: number;
    promedio: string | null;
    materias: string[];
    temas: string[];
  };
  clases: {
    fecha: string;
    tema: string;
    materia: string;
    nota: number | null;
    autoevaluacion: number | null;
  }[];
  hitos: { nivel: string; resumen: string }[];
  resumenIA: string;
}

const AUTOEVALUACION_LABELS: Record<number, string> = {
  1: "No entendió",
  2: "Más o menos",
  3: "Lo entendió",
  4: "Puede explicarlo",
};

export default function ReporteButton({ alumnoId, isPremium }: { alumnoId: string; isPremium: boolean }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reporteData, setReporteData] = useState<ReporteData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/reporte/${alumnoId}`);
      if (!res.ok) throw new Error("Error al generar reporte");
      const data = await res.json();
      setReporteData(data);
    } catch (err) {
      setError("No se pudo generar el reporte. Intentá de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isPremium) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
        <Crown size={20} className="text-amber-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-amber-800">Reporte PDF para Padres</p>
          <p className="text-xs text-amber-600">Disponible en la versión Premium.</p>
        </div>
      </div>
    );
  }

  if (!reporteData) {
    return (
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-3 text-sm font-bold text-white shadow-md hover:from-primary-700 hover:to-primary-800 transition-all active:scale-95 disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <Sparkles size={16} className="animate-wiggle" />
            Generando reporte con IA...
          </>
        ) : (
          <>
            <FileDown size={16} />
            Generar Reporte del Mes
          </>
        )}
      </button>
    );
  }

  // Report View (print-optimized)
  return (
    <>
      {/* Print controls — hidden when printing */}
      <div className="print:hidden flex items-center gap-3 mb-6">
        <button
          onClick={() => setReporteData(null)}
          className="flex items-center gap-2 text-sm font-medium text-surface-500 hover:text-surface-700 transition-colors"
        >
          <ArrowLeft size={16} /> Volver
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 transition-colors"
        >
          <Printer size={16} /> Imprimir / Descargar PDF
        </button>
      </div>

      {/* Printable Report */}
      {/* Printable Report */}
      <div className="bg-white rounded-3xl border border-surface-200 shadow-xl overflow-hidden print:shadow-none print:border-none print:rounded-none max-w-4xl mx-auto">
        {/* Header Decor */}
        <div className="h-4 trazos-gradient"></div>
        
        {/* Header Content */}
        <div className="px-8 pt-10 pb-6 print:px-6 print:pt-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-lg rotate-[-3deg]">
                  <Sparkles size={20} />
                </div>
                <h1 className="trazos-heading text-3xl font-black text-surface-900">Trazos</h1>
              </div>
              <h2 className="text-xl font-bold text-surface-900 tracking-tight">Informe de Seguimiento Pedagógico</h2>
              <p className="text-sm font-medium text-surface-500 uppercase tracking-widest">{reporteData.fecha}</p>
            </div>
            
            <div className="text-right space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-50 text-primary-700 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-primary-100">
                Resumen Mensual
              </div>
              <p className="text-sm font-bold text-surface-800 mt-2">Prof. {reporteData.maestra}</p>
              <p className="text-xs text-surface-400">trazosdemaestra.com.ar</p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-8 border-y border-surface-100 py-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-surface-400 mb-1">Alumno / Alumna</p>
              <p className="text-xl font-bold text-surface-900">{reporteData.alumno.nombre} {reporteData.alumno.apellido}</p>
              <p className="text-sm text-surface-600 font-medium">{reporteData.alumno.grado}° Grado</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-surface-400 mb-1">Desempeño General</p>
              <div className="flex items-center justify-end gap-2">
                <span className="text-3xl font-black text-primary-600">{reporteData.stats.promedio || "—"}</span>
                <span className="text-sm font-bold text-surface-400">/ 5.0</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 pb-12 print:px-6 space-y-10">
          {/* AI Summary - The "Heart" of the report */}
          <div className="relative">
             <div className="absolute -left-4 top-0 bottom-0 w-1 bg-primary-200 rounded-full"></div>
             <div className="space-y-4 italic text-surface-800 leading-relaxed text-lg font-medium font-serif">
                {reporteData.resumenIA.split('\n\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
             </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-3 gap-6">
            <div className="p-4 rounded-2xl bg-surface-50 border border-surface-100 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 opacity-10">
                  <FileDown size={40} className="text-surface-900" />
               </div>
               <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Clases Totales</p>
               <p className="text-2xl font-black text-surface-900">{reporteData.stats.totalClases}</p>
            </div>
            <div className="p-4 rounded-2xl bg-surface-50 border border-surface-100 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 opacity-10">
                  <BookOpen size={40} className="text-surface-900" />
               </div>
               <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Materias</p>
               <p className="text-2xl font-black text-surface-900">{reporteData.stats.materias.length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-surface-50 border border-surface-100 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 opacity-10">
                  <Sparkles size={40} className="text-surface-900" />
               </div>
               <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Hitos Clave</p>
               <p className="text-2xl font-black text-surface-900">{reporteData.hitos.length}</p>
            </div>
          </div>

          {/* Class Table */}
          {reporteData.clases.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-surface-400">Bitácora de Clases</h3>
              <div className="overflow-hidden rounded-2xl border border-surface-200">
                <table className="w-full text-sm">
                  <thead className="bg-surface-50 text-surface-500 text-[10px] uppercase font-black">
                    <tr>
                      <th className="px-5 py-4 text-left border-b border-surface-200">Fecha</th>
                      <th className="px-5 py-4 text-left border-b border-surface-200">Materia / Tema</th>
                      <th className="px-5 py-4 text-center border-b border-surface-200">Nota</th>
                      <th className="px-5 py-4 text-left border-b border-surface-200">Nivel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {reporteData.clases.map((clase, i) => (
                      <tr key={i} className="hover:bg-surface-50/50 transition-colors">
                        <td className="px-5 py-4 text-surface-500 font-medium">
                          {clase.fecha ? new Date(clase.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—"}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-surface-900">{clase.tema || "—"}</p>
                          <p className="text-[10px] text-surface-400 uppercase font-bold">{clase.materia || "Sin materia"}</p>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black ${clase.nota && clase.nota >= 4 ? 'bg-success-50 text-success-600' : 'bg-surface-100 text-surface-600'}`}>
                            {clase.nota || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-surface-600 italic">
                          {clase.autoevaluacion ? AUTOEVALUACION_LABELS[clase.autoevaluacion] : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bottom signature area for print */}
          <div className="pt-20 hidden print:flex justify-between items-end">
            <div className="border-t border-surface-300 w-48 text-center pt-2">
              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Firma de la Docente</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-surface-300 uppercase tracking-widest">Trazos | Tu cuaderno en limpio</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
