import { Users } from "lucide-react";
import { MAESTRAS_FUNDADORAS } from "@/lib/landing/config";

export default function SocialProof() {
  return (
    <section className="px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-surface-200 bg-white px-4 py-2 shadow-sm">
          <Users className="h-4 w-4 text-primary-600" />
          <span className="text-sm font-bold text-surface-800">
            En beta privada con {MAESTRAS_FUNDADORAS} maestras fundadoras
          </span>
        </div>
        <p className="mt-4 text-base text-surface-600">
          Estamos construyendo Trazos junto a maestras de verdad. Sumate y ayudanos a
          que sea la herramienta que siempre quisiste.
        </p>
      </div>

      {/*
        TODO: Testimonios reales. NO inventar. Cuando haya quotes con permiso,
        descomentar y completar con nombre, ciudad y (opcional) foto/avatar.

        <div className="mx-auto mt-10 grid max-w-5xl gap-5 sm:grid-cols-3">
          {testimonios.map((t) => (
            <figure key={t.nombre} className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
              <blockquote className="text-surface-700">“{t.texto}”</blockquote>
              <figcaption className="mt-4 text-sm font-bold text-surface-900">
                {t.nombre} · <span className="font-medium text-surface-500">{t.ciudad}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      */}
    </section>
  );
}
