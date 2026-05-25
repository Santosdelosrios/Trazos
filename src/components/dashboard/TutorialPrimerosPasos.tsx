"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  Calendar,
  ClipboardCheck,
  Wallet,
  Check,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";

interface OnboardingProgress {
  hasAlumnos: boolean;
  hasAgenda: boolean;
  hasClaseCerrada: boolean;
  hasCobro: boolean;
}

interface Props {
  nombreMaestra?: string;
  progress: OnboardingProgress;
}

const STEPS = [
  {
    key: "hasAlumnos" as const,
    title: "Crear tu primer alumno",
    description: "Armá la ficha de tu estudiante con nombre, grado y notas.",
    href: "/alumnos",
    cta: "Ir a Alumnos",
    icon: GraduationCap,
    color: "primary",
  },
  {
    key: "hasAgenda" as const,
    title: "Agendar una clase",
    description: "Planificá cuándo y a quién le vas a dar clase esta semana.",
    href: "/agenda",
    cta: "Ir a Agenda",
    icon: Calendar,
    color: "accent",
  },
  {
    key: "hasClaseCerrada" as const,
    title: "Cerrar tu primera clase",
    description: "Completá una clase con ejercicios y autoevaluación del alumno.",
    href: "/agenda",
    cta: "Ver Agenda",
    icon: ClipboardCheck,
    color: "success",
  },
  {
    key: "hasCobro" as const,
    title: "Registrar un cobro",
    description: "Llevá el control de pagos y cobranzas de tus alumnos.",
    href: "/finanzas/cobranzas",
    cta: "Ir a Cobranzas",
    icon: Wallet,
    color: "warning",
  },
] as const;

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string; badge: string }> = {
  primary: { bg: "bg-primary-50", text: "text-primary-600", ring: "ring-primary-200", badge: "bg-primary-100" },
  accent: { bg: "bg-accent-50", text: "text-accent-600", ring: "ring-accent-200", badge: "bg-accent-100" },
  success: { bg: "bg-success-50", text: "text-success-600", ring: "ring-success-200", badge: "bg-success-100" },
  warning: { bg: "bg-warning-50", text: "text-warning-600", ring: "ring-warning-200", badge: "bg-warning-100" },
};

const DISMISSED_KEY = "trazos-onboarding-dismissed";

export default function TutorialPrimerosPasos({ nombreMaestra = "Profe", progress }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "true");
  }, []);

  const completedCount = STEPS.filter((s) => progress[s.key]).length;
  const allDone = completedCount === STEPS.length;
  const activeStepIndex = STEPS.findIndex((s) => !progress[s.key]);

  if (allDone || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  const isFirstTime = completedCount === 0;
  const progressPct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="animate-fade-in-up">
      <div className="relative overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
        {/* Decorative blurs */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-primary-100 rounded-full blur-3xl opacity-40 pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-accent-100 rounded-full blur-3xl opacity-40 pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 border-b border-surface-100 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-md">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-surface-900">
                  {isFirstTime
                    ? `¡Bienvenida a Trazos, ${nombreMaestra}!`
                    : `Tu progreso, ${nombreMaestra}`}
                </h2>
                <p className="text-xs text-surface-500 mt-0.5">
                  {isFirstTime
                    ? "Completá estos 4 pasos para arrancar con todo."
                    : `${completedCount} de ${STEPS.length} pasos completados`}
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="rounded-lg p-1.5 text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors"
              aria-label="Cerrar tutorial"
            >
              <X size={16} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-3 w-full bg-surface-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary-400 to-primary-600 h-1.5 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.max(progressPct, completedCount > 0 ? 4 : 0)}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="relative z-10 p-4 sm:p-5">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => {
              const done = progress[step.key];
              const isActive = i === activeStepIndex;
              const isLocked = !done && i > activeStepIndex;
              const Icon = step.icon;
              const colors = COLOR_MAP[step.color];

              return (
                <div
                  key={step.key}
                  className={cn(
                    "relative rounded-xl border p-4 transition-all",
                    done && "border-success-200 bg-success-50/30",
                    isActive && `border-surface-200 ${colors.bg} ring-1 ${colors.ring} shadow-sm`,
                    isLocked && "border-surface-100 bg-surface-50/50 opacity-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon / Check */}
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        done && "bg-success-100 text-success-600",
                        isActive && `${colors.badge} ${colors.text}`,
                        isLocked && "bg-surface-100 text-surface-400"
                      )}
                    >
                      {done ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3
                        className={cn(
                          "text-sm font-bold leading-tight",
                          done ? "text-success-700 line-through decoration-success-300" : "text-surface-900"
                        )}
                      >
                        {step.title}
                      </h3>
                      <p className="mt-0.5 text-[11px] leading-snug text-surface-500">
                        {step.description}
                      </p>

                      {isActive && (
                        <Link
                          href={step.href}
                          className={cn(
                            "mt-2.5 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all active:scale-95",
                            step.color === "primary" && "bg-primary-600 hover:bg-primary-700",
                            step.color === "accent" && "bg-accent-600 hover:bg-accent-700",
                            step.color === "success" && "bg-success-600 hover:bg-success-700",
                            step.color === "warning" && "bg-warning-600 hover:bg-warning-700"
                          )}
                        >
                          {step.cta}
                          <ChevronRight size={14} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
