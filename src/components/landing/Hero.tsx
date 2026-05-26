import Link from "next/link";
import { Coffee, ChevronRight, Sparkles, Check } from "lucide-react";
import PhoneFrame from "./ui/PhoneFrame";
import { REGISTRO_URL, MAX_ALUMNOS_FREE } from "@/lib/landing/config";

export default function Hero() {
  return (
    <section className="relative px-5 pt-28 pb-12 sm:px-8 sm:pt-32 lg:pb-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-8">
        {/* Texto */}
        <div className="animate-fade-in-up text-center lg:text-left">
          <div className="inline-flex rotate-[-2deg] items-center gap-2 rounded-md border border-accent-200 bg-accent-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-600">
            <Coffee className="h-3 w-3" />
            <span>Hecho por y para maestras</span>
          </div>

          <h1 className="mt-5 font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-surface-900 sm:text-5xl lg:text-6xl">
            Que no se te escape{" "}
            <span className="text-primary-700">ni un cobro ni una clase</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-surface-700 lg:mx-0">
            Trazos junta a tus alumnos, tus clases y tus cobros en un solo lugar.
            Y <span className="trazos-highlight font-bold text-surface-900">Tiza</span>,
            tu asistente con IA, te prepara la próxima clase y te arma los ejercicios.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
            <Link
              href={REGISTRO_URL}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-7 py-4 text-base font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-lg active:scale-[0.98] sm:w-auto"
            >
              Empezar gratis
              <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#features"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-surface-200 px-7 py-4 text-base font-bold text-surface-800 transition-colors hover:border-surface-300 hover:bg-surface-100 sm:w-auto"
            >
              Ver cómo funciona
            </a>
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-surface-500 lg:justify-start">
            <Check className="h-4 w-4 text-success-500" />
            Gratis para siempre hasta {MAX_ALUMNOS_FREE} alumnos. Sin tarjeta.
          </p>
        </div>

        {/* Mockup: agenda en el celular + elementos flotantes */}
        <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
          <PhoneFrame>
            <HeroAgendaMockup />
          </PhoneFrame>

          {/* Post-it flotante */}
          <div
            className="absolute -left-2 top-10 w-40 rotate-[-6deg] rounded-sm bg-warning-100 p-3 shadow-md animate-float sm:-left-6"
            aria-hidden="true"
          >
            <p className="text-xs font-bold text-warning-800">Santi · jueves 17h</p>
            <p className="mt-1 text-[11px] leading-snug text-warning-700">
              ¡Repasar fracciones! Tiene prueba el lunes.
            </p>
          </div>

          {/* Chip de pago flotante */}
          <div
            className="absolute -right-1 bottom-16 w-44 rotate-[5deg] rounded-xl border-l-4 border-l-success-400 bg-white p-3 shadow-lg sm:-right-4"
            aria-hidden="true"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-surface-400">
                Transferencia
              </span>
              <span className="text-[10px] font-bold text-success-600">Pagado</span>
            </div>
            <p className="mt-1 text-base font-bold text-surface-900">$6.500</p>
            <p className="text-[11px] text-surface-500">Mía · Inglés</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Mini-agenda del día recreada en CSS (placeholder de screenshot real). */
function HeroAgendaMockup() {
  const clases = [
    { hora: "15:00", alumno: "Joaquín", tema: "Multiplicación", color: "primary" },
    { hora: "16:30", alumno: "Valentina", tema: "Comprensión lectora", color: "accent" },
    { hora: "18:00", alumno: "Santi", tema: "Fracciones", color: "success" },
  ] as const;

  const colorMap = {
    primary: "border-l-primary-400 bg-primary-50",
    accent: "border-l-accent-400 bg-accent-50",
    success: "border-l-success-400 bg-success-50",
  };

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
            Hoy
          </p>
          <p className="font-serif text-lg font-semibold text-surface-900">
            Jueves 25
          </p>
        </div>
        <span className="rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-bold text-primary-700">
          3 clases
        </span>
      </div>

      <div className="space-y-2.5">
        {clases.map((c) => (
          <div
            key={c.hora}
            className={`flex items-center gap-3 rounded-xl border-l-4 ${colorMap[c.color]} p-3 shadow-sm`}
          >
            <span className="text-xs font-bold text-surface-500">{c.hora}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-surface-900">{c.alumno}</p>
              <p className="truncate text-[11px] text-surface-500">{c.tema}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-900 p-3 text-white">
        <Sparkles className="h-4 w-4 shrink-0 text-accent-300" />
        <p className="text-[11px] font-medium leading-snug">
          Tiza ya preparó la clase de Santi
        </p>
      </div>
    </div>
  );
}
