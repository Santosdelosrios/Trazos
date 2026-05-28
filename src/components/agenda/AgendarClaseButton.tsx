"use client";

import { useState, useEffect } from "react";
import { CalendarPlus } from "lucide-react";
import PlanificarModal from "@/app/(dashboard)/agenda/modals/PlanificarModal";
import { getFeriados, formatFeriadoDate, type Feriado } from "@/lib/utils/feriados";
import { cn } from "@/lib/utils";

interface Props {
  alumno: { id: string; nombre: string; apellido: string };
  tarifaActual: number | null;
  className?: string;
  variant?: "primary" | "secondary";
}

/**
 * Botón para agendar una clase con un alumno pre-seleccionado.
 * Renderiza PlanificarModal con prefillAlumnoId para saltear el
 * selector de alumno (el modal arranca directo en el step 2).
 *
 * Pensado para insertarse en /alumnos/[id] y en el flujo post-crear
 * alumno, donde el contexto ya determina de qué alumno hablamos.
 */
export default function AgendarClaseButton({
  alumno,
  tarifaActual,
  className,
  variant = "secondary",
}: Props) {
  const [open, setOpen] = useState(false);
  const [feriados, setFeriados] = useState<Record<string, Feriado>>({});

  // Cargamos feriados solo cuando se abre el modal, para no pegarle
  // al endpoint en cada render del perfil del alumno.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    (async () => {
      try {
        const year = new Date().getFullYear();
        const data = await getFeriados(year);
        if (controller.signal.aborted) return;
        const map: Record<string, Feriado> = {};
        data.forEach((f) => {
          map[formatFeriadoDate(f, year)] = f;
        });
        setFeriados(map);
      } catch {
        // Si fallan los feriados, no es crítico. El modal funciona igual.
      }
    })();
    return () => controller.abort();
  }, [open]);

  const baseStyle = variant === "primary"
    ? "bg-primary-600 text-white hover:bg-primary-700"
    : "bg-white text-primary-700 border border-primary-200 hover:bg-primary-50";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition-all active:scale-95",
          baseStyle,
          className,
        )}
      >
        <CalendarPlus size={16} />
        Agendar Clase
      </button>

      <PlanificarModal
        open={open}
        onClose={() => setOpen(false)}
        alumnos={[alumno]}
        tarifaActual={tarifaActual}
        prefillAlumnoId={alumno.id}
        feriados={feriados}
      />
    </>
  );
}
