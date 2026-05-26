import Link from "next/link";
import { Check } from "lucide-react";
import SectionHeading from "./ui/SectionHeading";
import {
  REGISTRO_URL,
  PRECIO_PREMIUM_ARS,
  MAX_ALUMNOS_FREE,
  formatARS,
} from "@/lib/landing/config";

const FREE_FEATURES = [
  `Hasta ${MAX_ALUMNOS_FREE} alumnos`,
  "Agenda con arrastrar y soltar",
  "Cobros y cuenta de cada alumno",
  "Cierre de clases con seguimiento",
  "Reportes para las familias",
];

const PREMIUM_FEATURES = [
  "Alumnos ilimitados",
  "Tiza: prepara clases y ejercicios con IA",
  "Briefing diario y recordatorios de cobro",
  "Sincronización con Google Calendar",
  "Todo lo del plan gratis",
];

export default function PricingSection() {
  return (
    <section id="precios" className="scroll-mt-20 px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          eyebrow="Precios"
          title="Empezá gratis. Para siempre."
          subtitle="El plan gratis alcanza para arrancar de verdad. Premium es para cuando ya tenés muchos alumnos y querés que la IA te ahorre tiempo."
        />

        <div className="mt-12 grid items-start gap-6 md:grid-cols-2">
          {/* Free */}
          <div className="rounded-3xl border-2 border-primary-200 bg-white p-7 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-2xl font-semibold text-surface-900">
                Gratis
              </h3>
              <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-bold text-primary-700">
                Recomendado para empezar
              </span>
            </div>
            <p className="mt-3">
              <span className="font-serif text-4xl font-semibold text-surface-900">$0</span>
              <span className="text-surface-500"> /siempre</span>
            </p>
            <p className="mt-1 text-sm text-surface-500">Sin tarjeta. Sin vencimiento.</p>

            <Link
              href={REGISTRO_URL}
              className="mt-6 block rounded-xl bg-primary-600 px-6 py-3.5 text-center text-base font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-primary-700 active:scale-[0.98]"
            >
              Empezar gratis
            </Link>

            <ul className="mt-6 space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-surface-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-500" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Premium */}
          <div className="rounded-3xl border border-surface-200 bg-surface-50 p-7">
            <h3 className="font-serif text-2xl font-semibold text-surface-900">
              Premium
            </h3>
            <p className="mt-3">
              <span className="font-serif text-4xl font-semibold text-surface-900">
                {formatARS(PRECIO_PREMIUM_ARS)}
              </span>
              <span className="text-surface-500"> /mes</span>
            </p>
            <p className="mt-1 text-sm text-surface-500">Lo activás dentro de la app.</p>

            <Link
              href={REGISTRO_URL}
              className="mt-6 block rounded-xl border-2 border-surface-300 px-6 py-3.5 text-center text-base font-bold text-surface-800 transition-colors hover:border-surface-400 hover:bg-white"
            >
              Empezar gratis y decidir después
            </Link>

            <ul className="mt-6 space-y-3">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-surface-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
