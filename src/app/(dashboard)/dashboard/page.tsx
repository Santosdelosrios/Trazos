import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ResumenFinanciero from "@/components/finanzas/ResumenFinanciero";
import AgendaDiaWidget from "@/components/dashboard/AgendaDiaWidget";
import TutorialPrimerosPasos from "@/components/dashboard/TutorialPrimerosPasos";
import ClaseEnVivoWidget from "@/components/dashboard/ClaseEnVivoWidget";
import { getTodayKeyAR } from "@/lib/utils/fechas";
import {
  getAlumnosBasicos,
  getClasesDelMes,
  getEvaluacionStats,
  getAgendaPendiente,
  getResumenFinanciero,
  getNombreMaestra,
} from "@/lib/db/queries";
import {
  GraduationCap,
  BookOpen,
  Target,
  Sparkle,
  Calendar,
  Sparkles,
  Wallet,
  CreditCard,
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

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const todayStr = getTodayKeyAR();

  // Todas las queries paralelizadas usando la capa lib/db/queries
  // (cada una con React.cache() para dedup en mismo request)
  const [
    alumnosData,
    clasesMes,
    stats,
    proximasClases,
    resumenFinanciero,
    nombreMaestraDB,
  ] = await Promise.all([
    getAlumnosBasicos(user.id),
    getClasesDelMes(user.id, startOfMonth.toISOString()),
    getEvaluacionStats(user.id),
    getAgendaPendiente(user.id),
    getResumenFinanciero(user.id),
    getNombreMaestra(user.id),
  ]);

  const nombreMaestra = nombreMaestraDB || user.user_metadata?.nombre || "Profe";
  const totalAlumnos = alumnosData.length;
  const { promedioGeneral, tasaComprension } = stats;
  const clasesHoy = proximasClases.filter(i => i.fecha === todayStr);
  const numClasesHoy = clasesHoy.length;
  const subtitulo = numClasesHoy > 0
    ? `Hoy tenés ${numClasesHoy} clase${numClasesHoy > 1 ? 's' : ''} programada${numClasesHoy > 1 ? 's' : ''}.`
    : "No tenés clases programadas para hoy. ¡Día libre!";

  const onboardingProgress = {
    hasAlumnos: totalAlumnos > 0,
    hasAgenda: proximasClases.length > 0,
    hasClaseCerrada: promedioGeneral !== "—",
    hasCobro: (resumenFinanciero?.ingresos_mes ?? 0) > 0,
  };
  const onboardingComplete = Object.values(onboardingProgress).every(Boolean);

  return (
    <div className="animate-fade-in-up space-y-8 pb-12">
      <div>
        <h1 className="trazos-heading text-2xl font-extrabold tracking-tight text-surface-900">
          ¡Hola, {nombreMaestra}!
        </h1>
        <p className="mt-3 text-sm text-surface-500 font-medium">
          {subtitulo}
        </p>
      </div>

      {!onboardingComplete && (
        <TutorialPrimerosPasos nombreMaestra={nombreMaestra} progress={onboardingProgress} />
      )}

      {totalAlumnos > 0 && (
        <>
          <ClaseEnVivoWidget proximasClases={proximasClases} />

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Columna Izquierda: Agenda de Hoy */}
            <div className="lg:col-span-2">
              <AgendaDiaWidget items={proximasClases as any} alumnos={alumnosData || []} />
            </div>

        {/* Columna Derecha: Panel de Control */}
        <div className="lg:col-span-1 space-y-6">
          {/* Planificar Clase Quick Action */}
          <div className="rounded-2xl border border-primary-200 bg-white p-6 shadow-sm flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 animate-pulse-subtle">
              <Calendar size={32} />
            </div>
            <h2 className="text-lg font-bold text-surface-900">
              ¿Nueva clase?
            </h2>
            <p className="mt-2 text-sm text-surface-600 leading-relaxed">
              Planificá tus próximas sesiones en tu agenda.
            </p>
            <Link
              href="/agenda"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-3 text-sm font-bold text-white shadow-md transition-all duration-200 hover:from-primary-700 hover:to-primary-800 hover:shadow-lg active:scale-[0.98]"
            >
              <Sparkles size={16} />
              Planificar
            </Link>
          </div>

          {/* Acciones Rápidas Financieras */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/finanzas/cobranzas"
              className="group flex flex-col items-center text-center rounded-xl border border-success-200 bg-success-50 px-4 py-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-success-100"
            >
              <Wallet className="mb-2.5 text-success-600" size={20} />
              <span className="text-sm font-bold text-success-800">Cobro</span>
            </Link>
            <Link
              href="/finanzas/gastos"
              className="group flex flex-col items-center text-center rounded-xl border border-danger-200 bg-danger-50 px-4 py-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-danger-100"
            >
              <CreditCard className="mb-2.5 text-danger-600" size={20} />
              <span className="text-sm font-bold text-danger-800">Gasto</span>
            </Link>
          </div>

          {/* Stats Grid (2x2) */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Alumnos", value: totalAlumnos, icon: GraduationCap, color: "from-primary-500 to-primary-600", href: "/alumnos" },
              { label: "Clases mes", value: clasesMes ?? 0, icon: BookOpen, color: "from-accent-500 to-accent-600", href: "/clases" },
              { label: "Promedio", value: promedioGeneral !== "—" ? `${promedioGeneral}` : "—", icon: Target, color: "from-success-400 to-success-500", href: "/hitos" },
              { label: "Comprensión", value: tasaComprension, icon: Sparkle, color: "from-warning-400 to-warning-500", href: "/hitos" },
            ].map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className="group relative overflow-hidden rounded-xl border border-surface-200 bg-white p-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95 flex flex-col items-center text-center"
              >
                <div className={`absolute -right-3 -top-3 h-12 w-12 rounded-full bg-gradient-to-br ${stat.color} opacity-10 transition-transform duration-300 group-hover:scale-150`} />
                <stat.icon className="text-surface-900 mb-1" size={18} />
                <p className="text-lg font-bold text-surface-900 leading-none mb-0.5">
                  {stat.value}
                </p>
                <p className="text-[10px] font-medium text-surface-700 leading-tight">
                  {stat.label}
                </p>
              </Link>
            ))}
          </div>

          {/* Resumen Financiero */}
          <ResumenFinanciero resumen={resumenFinanciero} />
        </div>
      </div>
        </>
      )}
    </div>
  );
}
