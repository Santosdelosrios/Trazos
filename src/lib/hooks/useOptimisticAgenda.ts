"use client";

import { useOptimistic, startTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import type { AgendaItem } from "@/lib/types/database";
import {
  actualizarHorarioClase,
  actualizarDuracionClase,
} from "@/app/(dashboard)/agenda/actions";

type OptimisticAction =
  | { type: "move"; id: string; fecha: string; hora: string }
  | { type: "resize"; id: string; duracion: number };

/**
 * Optimistic UI para la agenda. El rollback es automático: si la Server Action
 * lanza, la transición termina sin revalidar y el estado vuelve a `initialAgenda`.
 * Compartido por /agenda (AgendaClient) y /dashboard (AgendaDiaWidget).
 */
export function useOptimisticAgenda(initialAgenda: AgendaItem[]) {
  const toast = useToast();

  const [optimisticAgenda, applyOptimistic] = useOptimistic(
    initialAgenda,
    (state: AgendaItem[], action: OptimisticAction) => {
      switch (action.type) {
        case "move":
          return state.map((c) =>
            c.id === action.id ? { ...c, fecha: action.fecha, hora: action.hora } : c
          );
        case "resize":
          return state.map((c) =>
            c.id === action.id ? { ...c, duracion_estimada: action.duracion } : c
          );
      }
    }
  );

  const reprogramarClase = (id: string, fecha: string, hora: string) => {
    startTransition(async () => {
      applyOptimistic({ type: "move", id, fecha, hora });
      try {
        await actualizarHorarioClase(id, fecha, hora);
      } catch {
        toast.error("No se pudo reprogramar la clase. Volvé a intentarlo.");
      }
    });
  };

  const redimensionarClase = (id: string, duracion: number) => {
    startTransition(async () => {
      applyOptimistic({ type: "resize", id, duracion });
      try {
        await actualizarDuracionClase(id, duracion);
      } catch {
        toast.error("No se pudo cambiar la duración. Volvé a intentarlo.");
      }
    });
  };

  return { optimisticAgenda, reprogramarClase, redimensionarClase };
}
