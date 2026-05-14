"use client";

import { useState } from "react";
import PasoTema, { type AlumnoBasico } from "@/components/cierre-clase/PasoTema";
import PasoEjercicio from "@/components/cierre-clase/PasoEjercicio";
import PasoAutoevaluacion from "@/components/cierre-clase/PasoAutoevaluacion";
import PasoResumen from "@/components/cierre-clase/PasoResumen";
import type { EjercicioGenerado, Materia, Grado, HitoAprendizaje, EjercicioResultado } from "@/lib/types/database";
import type { MateriaOption } from "@/lib/materias";
import { Sparkles, Check } from "lucide-react";

export default function NuevaClaseClient({ 
  alumnos, 
  initialAlumnoId,
  initialAgendaId,
  initialTema,
  initialDuracion,
  sugerencias,
  initialTarifa,
}: {
  alumnos: AlumnoBasico[];
  initialAlumnoId?: string;
  initialAgendaId?: string;
  initialTema?: string;
  initialDuracion?: number;
  sugerencias?: string[];
  initialTarifa?: number | null;
}) {
  const [step, setStep] = useState(1);
  const [ejercicios, setEjercicios] = useState<EjercicioGenerado[]>([]);
  const [ejercicioActualIndex, setEjercicioActualIndex] = useState(0);
  const [agendaId] = useState(initialAgendaId);
  const [selectedAlumnoId, setSelectedAlumnoId] = useState<string | null>(initialAlumnoId || null);

  // Datos guardados durante el flujo
  const [claseAlumnoId, setClaseAlumnoId] = useState<string>("00000000-0000-0000-0000-000000000000"); // Temporal mock uuid
  const [claseIdGuardada, setClaseIdGuardada] = useState<string | null>(null);
  const [resultados, setResultados] = useState<EjercicioResultado[]>([]);
  const [autoevaluacion, setAutoevaluacion] = useState<number | null>(null);
  
  // Estado final
  const [isGeneratingHito, setIsGeneratingHito] = useState(false);
  const [hitoData, setHitoData] = useState<HitoAprendizaje | null>(null);
  const [notaCalculada, setNotaCalculada] = useState<number | null>(null);

  // --- Handlers ---

  const handlePasoTemaSubmit = async (data: {
    temas: string[];
    grado_target: Grado;
    alumno_id: string;
  }) => {
    try {
      const response = await fetch("/api/ejercicio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tema: data.temas.join(", "),
          materia: "otro",
          grado_target: data.grado_target,
          alumno_ids: [data.alumno_id],
        }),
      });

      if (!response.ok) {
        throw new Error("Error al generar el ejercicio");
      }

      const result = await response.json();
      setEjercicios(result.ejercicios);
      setEjercicioActualIndex(0);
      setResultados([]);
      
      try {
        const { createClaseAndVinculo } = await import("./actions");
        const { claseId, claseAlumnoId } = await createClaseAndVinculo({
          temas: data.temas,
          materia: "otro",
          grado_target: data.grado_target,
          alumno_id: data.alumno_id,
          ejercicios_generados: result.ejercicios,
        });
        setClaseIdGuardada(claseId);
        setClaseAlumnoId(claseAlumnoId);
        setSelectedAlumnoId(data.alumno_id);
        setStep(2);
      } catch (dbError) {
        console.error("Error guardando clase:", dbError);
        alert("El ejercicio se generó pero no se pudo guardar en la base de datos.");
        // De todos modos avanzamos para no bloquear
        setClaseAlumnoId(data.alumno_id);
        setStep(2);
      }
    } catch (error) {
      console.error(error);
      alert("Hubo un error al generar el ejercicio. Intentá de nuevo.");
      throw error; // Propaga para que el spinner del botón frene
    }
  };

  const handleOptionSelect = (respuesta: string) => {
    const ejercicioActual = ejercicios[ejercicioActualIndex];
    const esCorrecta = respuesta === ejercicioActual.respuesta_correcta;

    const nuevoResultado: EjercicioResultado = {
      numero: ejercicioActualIndex + 1,
      consigna: ejercicioActual.consigna,
      respuesta_alumno: respuesta,
      respuesta_correcta: ejercicioActual.respuesta_correcta,
      es_correcta: esCorrecta,
    };

    setResultados((prev) => [...prev, nuevoResultado]);

    if (ejercicioActualIndex < ejercicios.length - 1) {
      // Pasar al siguiente ejercicio
      setEjercicioActualIndex((prev) => prev + 1);
    } else {
      // Terminaron los ejercicios, pasar a autoevaluación
      setStep(3);
    }
  };

  const calcularNota = (resultados: EjercicioResultado[], nivel: number) => {
    const correctas = resultados.filter((r) => r.es_correcta).length;
    // 70% correctas (0 a 7 ptos), 30% autoevaluación (0.75 a 3 ptos)
    const ptsCorrectas = (correctas / 3) * 7;
    const ptsAutoev = (nivel / 4) * 3;
    const notaBruta = ptsCorrectas + ptsAutoev;
    // Redondear a un decimal, max 5, mapping from 1-10 to 1-5 scale.
    // Actually the user wanted 1-5 scale.
    // Let's adjust formula for 1-5 scale.
    // 70% de 5 = 3.5. 30% de 5 = 1.5.
    const ptsCorrectas5 = (correctas / 3) * 3.5;
    const ptsAutoev5 = (nivel / 4) * 1.5;
    let nota5 = ptsCorrectas5 + ptsAutoev5;
    // clamp between 1 and 5
    if (nota5 < 1) nota5 = 1;
    if (nota5 > 5) nota5 = 5;
    return Number(nota5.toFixed(1));
  };

  const handleAutoevaluacionSubmit = async (nivel: number) => {
    setAutoevaluacion(nivel);
    setStep(4);
    setIsGeneratingHito(true);

    const notaFinal = calcularNota(resultados, nivel);
    setNotaCalculada(notaFinal);
    const correctas = resultados.filter((r) => r.es_correcta).length;

    try {
      const response = await fetch("/api/hito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clase_alumno_id: claseAlumnoId, 
          tema: "Tema evaluado", 
          respuestaCorrecta: correctas >= 2, // Para compatibilidad con la IA anterior (aprobar/desaprobar)
          nivelAutoevaluacion: nivel,
          resultados_completos: resultados,
          nota: notaFinal,
          total_correctas: correctas,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al generar el hito");
      }

      const result = await response.json();
      setHitoData(result.hito);

      // Si veníamos de la agenda, marcar como completada
      if (agendaId) {
        try {
          const { completarPlanificacion } = await import("../../agenda/actions");
          await completarPlanificacion(agendaId);
        } catch (agendaError) {
          console.error("Error al completar agenda:", agendaError);
        }
      }
    } catch (error) {
      console.error(error);
      alert("Hubo un error al generar el hito final.");
    } finally {
      setIsGeneratingHito(false);
    }
  };

  const handleRegistrarCobro = async (monto: number, estado: "pagado" | "pendiente") => {
    if (!claseIdGuardada) return;
    
    // El alumnoId lo podemos sacar de initialAlumnoId o formData, 
    // pero lo mejor es extraerlo cuando guardamos.
    // Como workaround rápido, the first step already requires alumno_id but we don't save it in state.
    // Wait, initialAlumnoId might be empty if they select it manually.
    // Let's add a quick fix by storing it in a ref or we can find it.
  };

  return (
    <div className="animate-fade-in-up">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-surface-900">
          <Sparkles className="text-primary-500" size={24} />
          Finalizar Clase
        </h1>
        <p className="mt-1 text-sm text-surface-700">
          Completá el cierre de clase para generar un ejercicio con IA.
        </p>
      </div>

      {/* Stepper indicator */}
      <div className="mb-8 flex items-center gap-2">
        {[
          { num: 1, label: "Tema" },
          { num: 2, label: "Ejercicio" },
          { num: 3, label: "Autoevaluación" },
          { num: 4, label: "Resumen" },
        ].map((item, idx) => {
          const isActive = step === item.num;
          const isPast = step > item.num;

          return (
            <div key={item.num} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  isActive
                    ? "bg-primary-600 text-white shadow-md shadow-primary-200"
                  : isPast
                    ? "bg-success-500 text-white"
                    : "bg-surface-200 text-surface-700"
                }`}
              >
                {isPast ? <Check size={16} strokeWidth={3} /> : item.num}
              </div>
              <span
                className={`text-sm font-medium ${
                  isActive ? "text-primary-700" : "text-surface-700"
                }`}
              >
                {item.label}
              </span>
              {idx < 3 && (
                <div
                  className={`mx-1 h-px w-8 lg:w-12 transition-colors ${
                    isPast ? "bg-success-500" : "bg-surface-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content Rendering */}
      <div className="relative">
        {step === 1 && (
          <PasoTema 
            alumnos={alumnos} 
            onSubmit={handlePasoTemaSubmit} 
            initialAlumnoId={initialAlumnoId}
            initialTema={initialTema}
            sugerencias={sugerencias}
          />
        )}
        
        {step === 2 && ejercicios.length > 0 && (
          <PasoEjercicio 
            key={ejercicioActualIndex}
            ejercicio={ejercicios[ejercicioActualIndex]} 
            numeroEjercicio={ejercicioActualIndex + 1}
            totalEjercicios={ejercicios.length}
            onOptionSelect={handleOptionSelect} 
          />
        )}
        
        {step === 3 && (
          <PasoAutoevaluacion onComplete={handleAutoevaluacionSubmit} />
        )}
        
        {step === 4 && (
          <PasoResumen 
            isLoading={isGeneratingHito} 
            hito={hitoData} 
            ejercicios={ejercicios}
            resultados={resultados}
            nota={notaCalculada}
            initialMonto={initialTarifa ?? undefined}
            initialDuracion={initialDuracion}
            onRegistrarCobro={(monto, duracion, estado) => {
              if (claseIdGuardada && selectedAlumnoId) {
                const { registrarCobroClase } = require("./actions");
                registrarCobroClase({
                  clase_id: claseIdGuardada,
                  alumno_id: selectedAlumnoId,
                  monto,
                  duracion_real: duracion,
                  estado
                }).catch(console.error);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
