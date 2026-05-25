import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Sparkles, TrendingUp, TrendingDown, Minus, ChevronRight, BookOpen, History } from "lucide-react";
import { getPlan } from "@/lib/plan";
import ReporteButton from "@/components/premium/ReporteButton";
import EditarAlumnoModal from "./EditarAlumnoModal";
import EmptyState from "@/components/ui/EmptyState";
import { MODELO_COBRO_CONFIG } from "@/lib/types/database";
import type { ModeloCobro } from "@/lib/types/database";

export const metadata = {
  title: "Perfil del Alumno | Trazos",
};

export default async function AlumnoPerfilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch alumno and historial in parallel (both use `id` from params)
  const [
    { data: alumno, error: alumnoError },
    { data: historial },
    plan,
  ] = await Promise.all([
    // 1. Fetch Alumno
    supabase
      .from("alumnos")
      .select("*")
      .eq("id", id)
      .eq("maestra_id", user.id)
      .single(),

    // 2. Fetch Clases y Resultados
    supabase
      .from("clase_alumnos")
      .select(`
        id,
        nota,
        total_correctas,
        autoevaluacion,
        respondido_at,
        clases (
          id,
          tema,
          fecha,
          clases_temas (
            temas (
              id,
              nombre
            )
          )
        )
      `)
      .eq("alumno_id", id)
      .order("respondido_at", { ascending: false }),

    // 3. Get plan
    getPlan(supabase, user.id),
  ]);

  if (alumnoError || !alumno) {
    redirect("/alumnos");
  }

  // 3. Procesar datos para la tabla de temas
  const temasEvaluados = new Map<string, {
    tema_id: string;
    nombre: string;
    ultimaNota: number;
    notaAnterior: number | null;
    vecesEvaluado: number;
  }>();

  if (historial) {
    // Como el historial está ordenado por fecha desc (más reciente primero),
    historial.forEach((registro: any) => {
      // Si la clase todavía no tiene nota (el alumno no la respondió), la ignoramos
      // para la tabla de evolución.
      if (registro.nota === null || registro.nota === undefined) return;

      const clase = registro.clases;
      if (!clase || !clase.clases_temas) return;
      
      const notaActual = registro.nota;
      
      clase.clases_temas.forEach((ct: any) => {
        const tema = ct.temas;
        if (!tema) return;
        
        const temaId = tema.id;
        
        if (!temasEvaluados.has(temaId)) {
          temasEvaluados.set(temaId, {
            tema_id: temaId,
            nombre: tema.nombre,
            ultimaNota: notaActual,
            notaAnterior: null,
            vecesEvaluado: 1,
          });
        } else {
          const stats = temasEvaluados.get(temaId)!;
          stats.vecesEvaluado++;
          if (stats.notaAnterior === null) {
            stats.notaAnterior = notaActual;
          }
        }
      });
    });
  }

  const temasArray = Array.from(temasEvaluados.values());

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-in-up pb-12">
      {/* Header & Breadcrumb */}
      <div>
        <nav className="mb-4 flex text-sm text-surface-500">
          <Link href="/alumnos" className="hover:text-primary-600 transition-colors">
            Mis Alumnos
          </Link>
          <span className="mx-2">/</span>
          <span className="text-surface-900 font-medium">{alumno.nombre} {alumno.apellido}</span>
        </nav>
        
        <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-surface-200">
          {/* Top row: avatar + identidad (siempre horizontal) */}
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 text-xl sm:text-2xl font-bold text-indigo-700">
              {alumno.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-surface-900 leading-tight truncate">
                {alumno.nombre} {alumno.apellido}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-md bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600">
                  {alumno.grado}
                </span>
                {(() => {
                  const modeloConfig = MODELO_COBRO_CONFIG[(alumno.modelo_cobro || "por_clase") as ModeloCobro];
                  return (
                    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold", modeloConfig.bg, modeloConfig.color)}>
                      {modeloConfig.icon} {modeloConfig.label}
                    </span>
                  );
                })()}
              </div>
              {alumno.notas && (
                <p className="mt-1.5 text-xs text-surface-500 line-clamp-2">
                  {alumno.notas}
                </p>
              )}
            </div>
          </div>

          {/* Actions row: stack en mobile, fila en desktop */}
          <div className="mt-4 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <EditarAlumnoModal
              alumno={{
                id: alumno.id,
                nombre: alumno.nombre,
                apellido: alumno.apellido,
                grado: alumno.grado,
                notas: alumno.notas,
                modelo_cobro: alumno.modelo_cobro || "por_clase",
                tarifa_override: alumno.tarifa_override ?? null,
              }}
            />
            <Link
              href={`/clases/nueva?alumnoId=${alumno.id}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-all active:scale-95"
            >
              <Sparkles size={16} />
              Cerrar Clase
            </Link>
          </div>
        </div>
      </div>

      {/* Report Button */}
      <ReporteButton alumnoId={alumno.id} isPremium={plan === "premium"} />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Columna Izquierda: Temas (2/3 de ancho) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl bg-white shadow-sm border border-surface-200 overflow-hidden">
            <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-surface-100 bg-surface-50/50">
              <h2 className="text-lg font-semibold text-surface-900">
                Evolución por Tema
              </h2>
              <p className="text-sm text-surface-500">
                Seguimiento del nivel (1-5) en cada tema evaluado.
              </p>
            </div>
            
            {temasArray.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                size="compact"
                title="Sin evaluaciones todavía"
                description="Cuando cierres una clase con este alumno, vas a ver acá la evolución por tema."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-surface-600">
                  <thead className="bg-surface-50 text-xs font-medium uppercase text-surface-500">
                    <tr>
                      <th className="px-3 py-3 sm:px-6">Tema</th>
                      <th className="px-3 py-3 text-center sm:px-6">Nota Actual</th>
                      <th className="px-3 py-3 text-center sm:px-6">Evolución</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {temasArray.map((tema) => {
                      // Determinar tendencia
                      let trendIcon = <Minus size={18} />;
                      let trendColor = "text-surface-400";
                      
                      if (tema.notaAnterior !== null) {
                        if (tema.ultimaNota > tema.notaAnterior) {
                          trendIcon = <TrendingUp size={18} />;
                          trendColor = "text-success-500";
                        } else if (tema.ultimaNota < tema.notaAnterior) {
                          trendIcon = <TrendingDown size={18} />;
                          trendColor = "text-danger-500";
                        }
                      } else {
                        trendIcon = <Minus size={18} className="opacity-20" />;
                      }

                      return (
                        <tr key={tema.tema_id} className="hover:bg-surface-50/50 transition-colors">
                          <td className="px-3 py-4 sm:px-6">{tema.nombre}</td>
                          <td className="px-3 py-4 text-center sm:px-6">
                            <span className={cn(
                              "inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold",
                              tema.ultimaNota >= 4 ? "bg-success-100 text-success-700" :
                              tema.ultimaNota >= 2.5 ? "bg-warning-100 text-warning-800" :
                              "bg-danger-100 text-danger-700"
                            )}>
                              {tema.ultimaNota}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-center sm:px-6">
                            <div className="flex flex-col items-center">
                              <span className={cn("text-lg font-black", trendColor)}>
                                {trendIcon}
                              </span>
                              {tema.notaAnterior !== null && (
                                <span className="text-[10px] text-surface-400">
                                  antes: {tema.notaAnterior}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Historial (Timeline) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl bg-white shadow-sm border border-surface-200 overflow-hidden">
            <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-surface-100 bg-surface-50/50">
              <h2 className="text-lg font-semibold text-surface-900">
                Últimas Clases
              </h2>
            </div>
            
            <div className="p-4 sm:p-6">
              {!historial || historial.length === 0 ? (
                <EmptyState
                  icon={History}
                  size="compact"
                  title="Sin actividad reciente"
                  description="Las últimas clases cerradas aparecerán acá."
                />
              ) : (
                <div className="relative border-l border-surface-200 ml-3 space-y-8">
                  {historial.slice(0, 5).map((registro: any) => {
                    const clase = registro.clases;
                    const date = registro.respondido_at ? new Date(registro.respondido_at) : new Date(clase.fecha);
                    
                    return (
                      <Link key={registro.id} href={`/clases/${registro.id}`} className="relative pl-6 block group hover:bg-surface-50/50 p-2 -ml-2 rounded-xl transition-colors">
                        <span className="absolute left-0.5 top-3 flex h-3 w-3 rounded-full bg-primary-400 ring-4 ring-white group-hover:bg-primary-500 transition-colors" />
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <time className="text-xs font-medium text-surface-400">
                              {date.toLocaleDateString("es-AR", { day: 'numeric', month: 'short' })}
                            </time>
                             <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              Ver detalle <ChevronRight size={12} />
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-surface-900 group-hover:text-primary-700 transition-colors">
                            {clase.tema}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "text-xs font-bold px-2 py-0.5 rounded",
                              registro.nota >= 4 ? "bg-success-50 text-success-700" :
                              registro.nota >= 2.5 ? "bg-warning-50 text-warning-700" :
                              "bg-danger-50 text-danger-700"
                            )}>
                              Nota: {registro.nota || '-'}
                            </span>
                            <span className="text-xs text-surface-500">
                              {registro.total_correctas}/3 correctas
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
