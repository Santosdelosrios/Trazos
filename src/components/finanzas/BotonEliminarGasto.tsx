"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";

interface Props {
  gastoId: string;
}

export default function BotonEliminarGasto({ gastoId }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        if (window.confirm("¿Estás segura de que querés eliminar este gasto?")) {
          startTransition(async () => {
            try {
              const { eliminarGasto } = await import("@/app/(dashboard)/finanzas/actions");
              await eliminarGasto(gastoId);
            } catch (err) {
              console.error("Error al eliminar gasto:", err);
            }
          });
        }
      }}
      disabled={isPending}
      className="rounded-lg p-2 text-surface-400 hover:bg-danger-50 hover:text-danger-500 transition-colors disabled:opacity-50"
      title="Eliminar gasto"
    >
      <Trash2 size={16} />
    </button>
  );
}
