"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { UserPlus, CalendarPlus, X } from "lucide-react";
import { createAlumno } from "./actions";
import NivelEducativoSelector from "@/components/alumnos/NivelEducativoSelector";
import SubmitButton from "@/components/ui/SubmitButton";
import PlanificarModal from "@/app/(dashboard)/agenda/modals/PlanificarModal";
import { getFeriados, formatFeriadoDate, type Feriado } from "@/lib/utils/feriados";
import { useToast } from "@/components/ui/Toast";

interface Props {
  atLimit: boolean;
  tarifaActual: number | null;
  tipoTarifa?: "por_hora" | "por_clase";
}

/**
 * Form de creación de alumno con flujo post-crear:
 *   1. La maestra completa los datos y guarda
 *   2. Aparece un modal: "¿Querés agendarle clases ahora?"
 *      - "Sí" → abre PlanificarModal con el alumno preseleccionado
 *      - "Más tarde" → cierra y limpia el form
 *
 * Reemplaza el form inline server-only de /alumnos/page.tsx para
 * habilitar la UX de seguimiento post-crear.
 */
export default function NuevoAlumnoForm({ atLimit, tarifaActual, tipoTarifa = "por_hora" }: Props) {
  const [isPending, startTransition] = useTransition();
  const [alumnoCreado, setAlumnoCreado] = useState<{ id: string; nombre: string; apellido: string } | null>(null);
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [feriados, setFeriados] = useState<Record<string, Feriado>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  // Cargamos feriados solo cuando se va a abrir el modal de agendar.
  useEffect(() => {
    if (!agendarOpen || Object.keys(feriados).length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const year = new Date().getFullYear();
        const data = await getFeriados(year);
        if (cancelled) return;
        const map: Record<string, Feriado> = {};
        data.forEach((f) => {
          map[formatFeriadoDate(f, year)] = f;
        });
        setFeriados(map);
      } catch {
        // Feriados no crítico.
      }
    })();
    return () => { cancelled = true; };
  }, [agendarOpen, feriados]);

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      try {
        const res = await createAlumno(formData);
        if (res) {
          setAlumnoCreado(res);
          formRef.current?.reset();
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al crear el alumno");
      }
    });
  };

  return (
    <>
      <form ref={formRef} action={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Nombre
            </label>
            <input
              name="nombre"
              type="text"
              required
              placeholder="Ej: Juan"
              className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Apellido
            </label>
            <input
              name="apellido"
              type="text"
              required
              placeholder="Ej: Pérez"
              className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-2">
            Nivel educativo
          </label>
          <NivelEducativoSelector name="grado" />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">
            Notas (Opcional)
          </label>
          <textarea
            name="notas"
            rows={2}
            placeholder="Dificultades, nivel, colegio..."
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>

        <SubmitButton
          disabled={atLimit || isPending}
          className="w-full mt-2"
          icon={<UserPlus size={16} />}
        >
          {atLimit ? "Límite alcanzado" : isPending ? "Guardando..." : "Guardar alumno"}
        </SubmitButton>
      </form>

      {/* Modal post-crear: ofrece agendar clases */}
      {alumnoCreado && !agendarOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-surface-900/30 backdrop-blur-sm"
            onClick={() => setAlumnoCreado(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-surface-200 bg-white shadow-2xl animate-fade-in-up overflow-hidden">
            <div className="flex items-center justify-between border-b border-surface-100 bg-success-50/40 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-100 text-success-700">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-surface-900">
                    {alumnoCreado.nombre} agregado
                  </h3>
                  <p className="text-[11px] text-surface-500">¿Querés agendarle clases ahora?</p>
                </div>
              </div>
              <button
                onClick={() => setAlumnoCreado(null)}
                className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-surface-600">
                Podés planificar la primera clase ahora y elegir si querés que se repita semanalmente. Si preferís hacerlo después, vas a poder agendar desde el perfil del alumno o desde la agenda.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setAlumnoCreado(null)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-surface-600 hover:bg-surface-100 transition-colors"
                >
                  Más tarde
                </button>
                <button
                  type="button"
                  onClick={() => setAgendarOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-all active:scale-95"
                >
                  <CalendarPlus size={16} />
                  Agendar primera clase
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de planificar (se abre desde el dialog post-crear) */}
      {alumnoCreado && (
        <PlanificarModal
          open={agendarOpen}
          onClose={() => {
            setAgendarOpen(false);
            setAlumnoCreado(null);
          }}
          alumnos={[alumnoCreado]}
          tarifaActual={tarifaActual}
          tipoTarifa={tipoTarifa}
          prefillAlumnoId={alumnoCreado.id}
          feriados={feriados}
        />
      )}
    </>
  );
}
