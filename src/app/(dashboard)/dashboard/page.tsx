import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { type Materia } from "@/lib/types/database";
import ResumenFinanciero from "@/components/finanzas/ResumenFinanciero";
import SaludNegocio from "@/components/dashboard/SaludNegocio";
import TutorialPrimerosPasos from "@/components/dashboard/TutorialPrimerosPasos";
import ClaseEnVivoWidget from "@/components/dashboard/ClaseEnVivoWidget";
import type { ResumenFinancieroMes } from "@/lib/types/database";
import { 
  GraduationCap, 
  BookOpen, 
  Target, 
  Sparkle, 
  Calendar, 
  Rocket, 
  Sparkles, 
  Trophy, 
  Wallet, 
  CreditCard,
  ChevronRight
} from "lucide-react";

export const metadata = {
  title: "Inicio",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Clases este mes
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Parallelize all data fetching
  const [
    { count: totalAlumnos },
    { count: clasesMes },
    { data: statsData },
    { data: proximasClases },
    { data: resumenFinData },
    { data: metricasNegocioRaw },
    { data: maestraData }
  ] = await Promise.all([
    supabase
      .from("alumnos")
      .select("*", { count: "exact", head: true })
      .eq("maestra_id", user.id),
    
    supabase
      .from("clases")
      .select("*", { count: "exact", head: true })
      .eq("maestra_id", user.id)
      .gte("fecha", startOfMonth.toISOString()),

    supabase
      .from("clase_alumnos")
      .select("nota, autoevaluacion, clases!inner(maestra_id)")
      .eq("clases.maestra_id", user.id)
      .not("nota", "is", null),

    supabase
      .from("agenda")
      .select(`
        id, fecha, hora, tema_previsto, materia, alumno_id, duracion_estimada,
        alumnos!inner(id, nombre, apellido)
      `)
      .eq("maestra_id", user.id)
      .eq("estado", "pendiente")
      .gte("fecha", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0])
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true })
      .limit(10),

    supabase.rpc("resumen_financiero_mes", { p_maestra_id: user.id }),
    
    supabase.rpc("obtener_metricas_negocio", { p_maestra_id: user.id }),

    supabase
      .from("maestras")
      .select("nombre")
      .eq("id", user.id)
      .maybeSingle()
  ]);

  const nombreMaestra = maestraData?.nombre || user.user_metadata?.nombre || "Maestra";
  const resumenFinanciero: ResumenFinancieroMes | null = resumenFinData?.[0] ?? null;
  const metricasNegocio = metricasNegocioRaw?.[0] ?? null;

  let promedioGeneral = "—";
  let tasaComprension = "—";

  if (statsData && statsData.length > 0) {
    const notasValidas = statsData.map((d: any) => d.nota).filter((n: any) => n !== null);
    if (notasValidas.length > 0) {
      const sum = notasValidas.reduce((a: number, b: number) => a + b, 0);
      promedioGeneral = (sum / notasValidas.length).toFixed(1);
    }

    const autoevalValidas = statsData.map((d: any) => d.autoevaluacion).filter((a: any) => a !== null);
    if (autoevalValidas.length > 0) {
      const altas = autoevalValidas.filter((a: number) => a >= 3).length;
      tasaComprension = Math.round((altas / autoevalValidas.length) * 100) + "%";
    }
  }

  const proximasFiltradas = proximasClases?.filter(c => {
    const classDate = new Date(c.fecha + "T00:00:00");
    const today = new Date();
    today.setHours(0,0,0,0);
    return classDate >= today;
  }).slice(0, 5) || [];

  return (
    <div className="animate-fade-in-up space-y-8 pb-12">
      <div>
        <h1 className="trazos-heading text-2xl font-extrabold tracking-tight text-surface-900">
          ¡Hola, {nombreMaestra}!
        </h1>
        <p className="mt-3 text-sm text-surface-500 font-medium">
          Acá podés ver un resumen de tus clases y el progreso de tus alumnos.
        </p>
      </div>
      
      {totalAlumnos === 0 && <TutorialPrimerosPasos />}

      <ClaseEnVivoWidget proximasClases={proximasClases || []} />

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Alumnos", value: totalAlumnos ?? 0, icon: GraduationCap, color: "from-primary-500 to-primary-600", href: "/alumnos" },
          { label: "Clases este mes", value: clasesMes ?? 0, icon: BookOpen, color: "from-accent-500 to-accent-600", href: "/clases" },
          { label: "Promedio General", value: promedioGeneral !== "—" ? `${promedioGeneral}/5` : "—", icon: Target, color: "from-success-400 to-success-500", href: "/hitos" },
          { label: "Alta Comprensión", value: tasaComprension, icon: Sparkle, color: "from-warning-400 to-warning-500", href: "/hitos" },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group relative overflow-hidden rounded-2xl border border-surface-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
          >
            <div className={`absolute -right-3 -top-3 h-16 w-16 rounded-full bg-gradient-to-br ${stat.color} opacity-10 transition-transform duration-300 group-hover:scale-150`} />
            <div className="relative">
              <stat.icon className="text-surface-900" size={24} />
              <p className="mt-3 text-2xl font-bold text-surface-900">
                {stat.value}
              </p>
              <p className="text-xs font-medium text-surface-700">
                {stat.label}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Widgets de Resumen (Top Row) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SaludNegocio metricas={metricasNegocio} />
        <ResumenFinanciero resumen={resumenFinanciero} />
      </div>

      {/* Main content grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Próximas Clases */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-surface-100 bg-surface-50/50 px-6 py-5">
              <h2 className="text-lg font-semibold text-surface-900">
                Próximas Clases Agendadas
              </h2>
            </div>
            
            {proximasFiltradas.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-100">
                  <Calendar className="text-surface-400" size={20} />
                </div>
                <p className="text-sm text-surface-500">No tenés clases agendadas para hoy o mañana.</p>
                <Link href="/agenda" className="mt-4 flex items-center justify-center gap-1 text-xs font-bold text-primary-600 hover:underline">
                  Ir a la Agenda <ChevronRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-surface-100">
                {proximasFiltradas.map((clase: any) => (
                  <div 
                    key={clase.id} 
                    className="p-6 transition-colors hover:bg-surface-50/50"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex flex-col items-center justify-center min-w-[50px] rounded-xl bg-surface-100 py-1.5 px-2">
                          <span className="text-xs font-black text-surface-900 leading-none">
                            {new Date(clase.fecha).toLocaleDateString("es-AR", { day: 'numeric' })}
                          </span>
                          <span className="text-[8px] uppercase font-bold text-surface-500 mt-1">
                            {new Date(clase.fecha).toLocaleDateString("es-AR", { month: 'short' })}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold text-surface-900 truncate">
                              {clase.alumnos.nombre} {clase.alumnos.apellido}
                            </span>
                          </div>
                          <p className="text-xs text-surface-500 truncate">
                            {clase.hora.substring(0, 5)} hs · {clase.tema_previsto || "Tema a definir"}
                          </p>
                        </div>
                      </div>
                      
                      <Link
                        href={`/clases/nueva?alumnoId=${clase.alumno_id}&tema=${encodeURIComponent(clase.tema_previsto || "")}&agendaId=${clase.id}`}
                        className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-700 transition-all active:scale-95 whitespace-nowrap"
                      >
                        <Rocket size={14} />
                        Iniciar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="border-t border-surface-100 bg-surface-50 p-4 text-center">
              <Link href="/agenda" className="flex items-center justify-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
                Ver agenda completa <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        {/* Planificar Clase Quick Action */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-primary-200 bg-white p-6 shadow-sm flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 animate-pulse-subtle">
              <Calendar size={32} />
            </div>
            <h2 className="text-lg font-bold text-surface-900">
              ¿Nueva clase?
            </h2>
            <p className="mt-2 text-sm text-surface-600 leading-relaxed">
              Planificá tus próximas sesiones para tener todo organizado.
            </p>
            <Link
              href="/agenda"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-3 text-sm font-bold text-white shadow-md transition-all duration-200 hover:from-primary-700 hover:to-primary-800 hover:shadow-lg active:scale-[0.98]"
            >
              <Sparkles size={16} />
              Planificar en Agenda
            </Link>
            
            <div className="mt-8 w-full border-t border-surface-100 pt-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400 mb-4">Acceso Rápido</p>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/alumnos" className="flex flex-col items-center gap-2 rounded-xl bg-surface-50 p-3 hover:bg-surface-100 transition-colors">
                  <GraduationCap className="text-primary-600" size={20} />
                  <span className="text-[10px] font-bold text-surface-700">Alumnos</span>
                </Link>
                <Link href="/hitos" className="flex flex-col items-center gap-2 rounded-xl bg-surface-50 p-3 hover:bg-surface-100 transition-colors">
                  <Trophy className="text-warning-600" size={20} />
                  <span className="text-[10px] font-bold text-surface-700">Logros</span>
                </Link>
                <Link href="/finanzas" className="flex flex-col items-center gap-2 rounded-xl bg-surface-50 p-3 hover:bg-surface-100 transition-colors">
                  <Wallet className="text-success-600" size={20} />
                  <span className="text-[10px] font-bold text-surface-700">Finanzas</span>
                </Link>
                <Link href="/finanzas/cobranzas" className="flex flex-col items-center gap-2 rounded-xl bg-surface-50 p-3 hover:bg-surface-100 transition-colors">
                  <CreditCard className="text-accent-600" size={20} />
                  <span className="text-[10px] font-bold text-surface-700">Cobros</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
