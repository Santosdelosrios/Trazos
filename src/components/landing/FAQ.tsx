import { Plus } from "lucide-react";
import SectionHeading from "./ui/SectionHeading";
import { MAX_ALUMNOS_FREE } from "@/lib/landing/config";

/** Compartido con el JSON-LD de FAQPage en page.tsx. */
export const FAQ_ITEMS: { pregunta: string; respuesta: string }[] = [
  {
    pregunta: "¿Es realmente gratis?",
    respuesta: `Sí. El plan gratis es para siempre, hasta ${MAX_ALUMNOS_FREE} alumnos, y no te pedimos tarjeta. Si algún día tenés muchos alumnos, podés pasar a Premium, pero no es obligatorio.`,
  },
  {
    pregunta: "¿Mis alumnos tienen que registrarse?",
    respuesta:
      "No. Trazos es tuyo. Tus alumnos no necesitan crear cuenta ni instalar nada: vos llevás todo desde tu lado.",
  },
  {
    pregunta: "¿Cómo cobro con Trazos? ¿Pasa por ustedes mi plata?",
    respuesta:
      "Tu plata nunca pasa por nosotros. Vos seguís cobrando como siempre (transferencia o efectivo) y en Trazos registrás quién te pagó y quién te debe. MercadoPago solo se usa si decidís pagar el plan Premium.",
  },
  {
    pregunta: "¿Qué pasa con mis datos?",
    respuesta:
      "Son tuyos. Los guardamos de forma segura, no los vendemos ni los compartimos con nadie. Podés exportarlos o borrar tu cuenta cuando quieras.",
  },
  {
    pregunta: "¿Puedo importar mis alumnos desde Excel?",
    respuesta:
      "Estamos terminando la importación desde Excel. Por ahora cargás cada alumno en menos de un minuto, y si tenés una lista larga escribinos y te damos una mano.",
  },
  {
    pregunta: "¿Funciona en el celular?",
    respuesta:
      "Sí, está pensada primero para el celu. Podés anotar la clase mientras estás con el alumno, desde el teléfono, la tablet o la compu.",
  },
  {
    pregunta: "¿Qué es Tiza exactamente?",
    respuesta:
      "Tiza es tu asistente con inteligencia artificial. Te prepara el plan de la próxima clase con el material que subís, te arma ejercicios a la medida de cada alumno y te ayuda a organizar los cobros del mes.",
  },
  {
    pregunta: "¿Puedo cancelar cuando quiera?",
    respuesta:
      "Sí. El plan gratis no vence nunca. Si tenés Premium, lo cancelás cuando quieras y seguís usando Trazos con el plan gratis.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="scroll-mt-20 px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="Preguntas" title="Lo que se suele preguntar" />

        <div className="mt-10 space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.pregunta}
              className="group rounded-2xl border border-surface-200 bg-white p-5 shadow-sm transition-colors open:border-primary-200 open:bg-primary-50/30"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-surface-900 marker:hidden [&::-webkit-details-marker]:hidden">
                {item.pregunta}
                <Plus className="h-5 w-5 shrink-0 text-primary-600 transition-transform duration-300 group-open:rotate-45" />
              </summary>
              <p className="mt-3 leading-relaxed text-surface-700">{item.respuesta}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
