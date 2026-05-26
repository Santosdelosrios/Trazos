import SectionHeading from "./ui/SectionHeading";

const dolores = [
  {
    texto: "Pasaste otra hora armando el reporte para los papás de Juan.",
    rotacion: "rotate-[-1.5deg]",
    fondo: "bg-white",
  },
  {
    texto: "No te acordás si Sofía pagó las clases de septiembre.",
    rotacion: "rotate-[1.5deg]",
    fondo: "bg-warning-100",
  },
  {
    texto: "Otra noche preparando ejercicios desde cero.",
    rotacion: "rotate-[-1deg]",
    fondo: "bg-white",
  },
];

export default function PainSection() {
  return (
    <section className="px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="¿Te suena esto?"
          title="Llevar las clases en la cabeza, en cuadernos y en mil chats cansa."
          subtitle="Si te pasa alguna de estas, no sos vos: te falta una herramienta."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {dolores.map((d) => (
            <div
              key={d.texto}
              className={`${d.fondo} ${d.rotacion} flex min-h-[160px] items-center rounded-2xl border border-surface-200 p-6 shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition-transform hover:rotate-0`}
            >
              <p className="font-serif text-xl font-medium leading-snug text-surface-800">
                “{d.texto}”
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
