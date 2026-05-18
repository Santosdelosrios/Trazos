"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { eliminarClase } from "./actions";
import { Search, Trash2, ChevronRight, Info, Loader2 } from "lucide-react";

interface HistorialItem {
  id: string; // id de clase_alumnos
  nota: number | null;
  total_correctas: number;
  respondido_at: string;
  clase_id: string;
  clases: {
    tema: string;
    materia: string;
    fecha: string;
  };
  alumnos: {
    nombre: string;
    apellido: string;
  };
}

interface HistorialClientProps {
  data: HistorialItem[];
}

export default function HistorialClient({ data }: HistorialClientProps) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch = 
        `${item.alumnos.nombre} ${item.alumnos.apellido}`.toLowerCase().includes(search.toLowerCase()) ||
        item.clases.tema.toLowerCase().includes(search.toLowerCase());
      
      return matchesSearch;
    });
  }, [data, search]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header & Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-900">
            Historial de Clases
          </h1>
          <p className="mt-1 text-sm text-surface-700">
            Revisá y filtrá todos los cierres de clase realizados.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-surface-100 px-4 py-2 text-sm font-medium text-surface-700">
          <span className="text-primary-600 font-bold">{filteredData.length}</span> Evaluaciones encontradas
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por alumno o tema..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-surface-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-surface-600">
            <thead className="bg-surface-50 text-xs font-medium uppercase text-surface-500">
              <tr>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Alumno</th>
                <th className="px-6 py-4">Tema</th>
                <th className="px-6 py-4 text-center">Nota</th>
                <th className="px-6 py-4 text-center">Correctas</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-surface-500">
                    No se encontraron resultados para tu búsqueda.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => {
                  const date = item.respondido_at ? new Date(item.respondido_at) : new Date(item.clases.fecha);
                  const isExpress = item.nota === null && !item.respondido_at;
                  return (
                    <tr key={item.id} className="hover:bg-surface-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span suppressHydrationWarning className="font-bold text-surface-900">
                            {date.toLocaleDateString("es-AR", { day: 'numeric', month: 'short' })}
                          </span>
                          <span suppressHydrationWarning className="text-[10px] text-surface-400">
                            {date.toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-surface-900">
                        {item.alumnos.nombre} {item.alumnos.apellido}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-surface-700 font-medium truncate max-w-[200px]" title={item.clases.tema}>
                          {item.clases.tema}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isExpress ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-surface-100 px-2.5 py-1 text-xs font-bold text-surface-600 border border-surface-200">
                            ⚡ Express
                          </span>
                        ) : item.nota !== null ? (
                          <span className={cn(
                            "inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold",
                            item.nota >= 4 ? "bg-success-100 text-success-700" :
                            item.nota >= 2.5 ? "bg-warning-100 text-warning-800" :
                            "bg-danger-100 text-danger-700"
                          )}>
                            {item.nota}
                          </span>
                        ) : (
                          <span className="text-surface-400 italic text-xs">Pendiente</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-surface-500">
                        {isExpress ? "—" : `${item.total_correctas}/3`}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link 
                            href={`/clases/${item.id}`}
                            className="flex items-center gap-1 text-primary-600 hover:text-primary-800 text-xs font-bold hover:underline"
                          >
                            Ver detalle <ChevronRight size={14} />
                          </Link>
                          
                          {deletingId === item.id ? (
                            <div className="flex items-center gap-2 animate-fade-in-up">
                              <span className="text-[10px] text-danger-500 font-bold">¿Borrar?</span>
                              <button
                                disabled={isPending}
                                onClick={() => {
                                  startTransition(async () => {
                                    try {
                                      const res = await eliminarClase(item.id);
                                      if (res?.error) {
                                        alert("Error al eliminar: " + res.error);
                                      }
                                      setDeletingId(null);
                                    } catch (error: any) {
                                      alert("Hubo un problema de conexión: " + error.message);
                                      setDeletingId(null);
                                    }
                                  });
                                }}
                                className={cn(
                                  "rounded bg-danger-500 px-2 py-1 text-[10px] font-bold text-white transition-colors hover:bg-danger-400",
                                  isPending && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                {isPending ? <Loader2 size={12} className="animate-spin" /> : "Sí"}
                              </button>
                              <button
                                disabled={isPending}
                                onClick={() => setDeletingId(null)}
                                className="rounded bg-surface-200 px-2 py-1 text-[10px] font-bold text-surface-700 transition-colors hover:bg-surface-300"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              disabled={isPending}
                              onClick={() => setDeletingId(item.id)}
                              className={cn(
                                "text-surface-400 hover:text-danger-500 transition-all p-1.5 rounded-lg hover:bg-danger-50",
                                isPending && "opacity-50 cursor-not-allowed"
                              )}
                              title="Eliminar registro"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
