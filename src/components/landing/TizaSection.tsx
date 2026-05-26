import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";
import TizaDemo from "./TizaDemo";
import { REGISTRO_URL } from "@/lib/landing/config";

export default function TizaSection() {
  return (
    <section className="px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl trazos-chalkboard px-6 py-12 shadow-xl sm:px-12 sm:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Texto */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-300">
              <Sparkles className="h-3.5 w-3.5" />
              Conocé a Tiza
            </div>

            <h2 className="mt-5 font-serif text-3xl font-semibold leading-tight tracking-tight text-surface-50 sm:text-4xl">
              Tu asistente que{" "}
              <span className="trazos-chalk-underline text-accent-300">
                prepara la clase
              </span>{" "}
              con vos
            </h2>

            <p className="mt-5 text-lg leading-relaxed text-surface-50/80">
              Subís el cuadernillo de matemática de 4° y Tiza te arma 10 ejercicios
              extra, adaptados al nivel de tu alumno. Lo que sabe de las clases
              anteriores lo usa para que cada plan sea mejor que el anterior.
            </p>

            <ul className="mt-6 space-y-2.5 text-surface-50/80">
              {[
                "Prepara el plan de la próxima clase",
                "Arma ejercicios desde tu propio material",
                "Te ayuda a organizar los cobros del mes",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-300" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <Link
              href={REGISTRO_URL}
              className="group mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-accent-400 px-6 py-3.5 text-base font-bold text-chalk-900 shadow-md transition-all hover:-translate-y-0.5 hover:bg-accent-300 active:scale-[0.98]"
            >
              Probar a Tiza gratis
              <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Demo animada */}
          <div>
            <TizaDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
