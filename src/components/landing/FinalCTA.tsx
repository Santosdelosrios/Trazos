import Link from "next/link";
import { ChevronRight, Check } from "lucide-react";
import { REGISTRO_URL, MAX_ALUMNOS_FREE } from "@/lib/landing/config";

export default function FinalCTA() {
  return (
    <section className="px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-4xl rounded-3xl trazos-chalkboard px-6 py-14 text-center shadow-xl sm:px-12 sm:py-16">
        <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-surface-50 sm:text-4xl">
          Guardá los cuadernos. <br className="hidden sm:block" />
          Probá Trazos esta tarde.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-surface-50/80">
          Tardás menos de un minuto en cargar tu primer alumno y armar tu primera
          clase. Después no querés volver atrás.
        </p>

        <div className="mt-8">
          <Link
            href={REGISTRO_URL}
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-accent-400 px-8 py-4 text-base font-bold text-chalk-900 shadow-md transition-all hover:-translate-y-0.5 hover:bg-accent-300 active:scale-[0.98]"
          >
            Empezar gratis
            <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-surface-50/60">
          <Check className="h-4 w-4 text-accent-300" />
          Gratis para siempre hasta {MAX_ALUMNOS_FREE} alumnos. Sin tarjeta.
        </p>
      </div>
    </section>
  );
}
