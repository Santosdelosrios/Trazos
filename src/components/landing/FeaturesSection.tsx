import { Wallet, Sparkles, FileText, Target, Clock, Home } from "lucide-react";
import SectionHeading from "./ui/SectionHeading";
import BrowserFrame from "./ui/BrowserFrame";
import FeatureRow from "./FeatureRow";

export default function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-20 px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Todo en un lugar"
          title="Lo que antes te llevaba la tarde, ahora te lleva un rato"
          subtitle="Sin planillas, sin papeles sueltos, sin tratar de acordarte de todo."
        />

        <div className="mt-16 space-y-20 lg:space-y-28">
          <FeatureRow
            eyebrow="Tu agenda"
            title="Tu semana de clases, sin papeles"
            description="Arrastrá una clase para reprogramarla, mirá tu semana de un vistazo y dejá de anotar horarios en tres lugares distintos."
            bullets={[
              "Arrastrá y soltá para mover clases",
              "Clases que se repiten todas las semanas",
              "Funciona igual de bien en el celu",
            ]}
            mockup={<AgendaMockup />}
          />

          <FeatureRow
            reverse
            eyebrow="Cobros"
            title="Cobros que no se te escapan"
            description="Mirá de un vistazo quién te debe y cuánto vas a facturar este mes. Cada alumno con su forma de cobro: por clase, por paquete, abono mensual o cuenta corriente."
            bullets={[
              "Quién pagó y quién te debe, claro",
              "Cuatro modelos de cobro distintos",
              "El total del mes, siempre a mano",
            ]}
            mockup={<FinanzasMockup />}
          />

          <FeatureRow
            eyebrow="Tiza · IA"
            title="Tiza prepara la próxima clase por vos"
            description="Tu asistente con inteligencia artificial usa lo que ya sabe de cada alumno para armarte el plan de la clase y los ejercicios. Vos revisás y listo."
            bullets={[
              "Plan de clase con objetivo y momentos",
              "Ejercicios a la medida del alumno",
              "Aprende de las clases anteriores",
            ]}
            mockup={<TizaPlanMockup />}
          />

          <FeatureRow
            reverse
            eyebrow="Reportes"
            title="Reportes para las familias en un click"
            description="Lo que más te piden los padres, listo en segundos. Un resumen prolijo del mes de cada alumno que mandás por WhatsApp sin escribir una palabra."
            bullets={[
              "Resumen mensual automático",
              "Con los temas vistos y el progreso",
              "Listo para compartir",
            ]}
            mockup={<ReporteMockup />}
          />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Mockups recreados en CSS (placeholders de screenshots reales)
   ============================================================ */

function AgendaMockup() {
  const dias = ["Lun", "Mar", "Mié", "Jue", "Vie"];
  const clases: Record<string, { t: string; n: string; c: string }[]> = {
    Lun: [{ t: "15h", n: "Joaquín", c: "bg-primary-100 text-primary-800" }],
    Mar: [{ t: "17h", n: "Mía", c: "bg-accent-100 text-accent-700" }],
    Mié: [
      { t: "16h", n: "Valen", c: "bg-success-100 text-success-800" },
      { t: "18h", n: "Tomás", c: "bg-primary-100 text-primary-800" },
    ],
    Jue: [{ t: "17h", n: "Santi", c: "bg-accent-100 text-accent-700" }],
    Vie: [{ t: "15h", n: "Lola", c: "bg-primary-100 text-primary-800" }],
  };

  return (
    <BrowserFrame url="trazosdemaestra.com.ar/agenda">
      <div className="p-4">
        <div className="grid grid-cols-5 gap-2">
          {dias.map((d) => (
            <div key={d} className="text-center">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-surface-400">
                {d}
              </p>
              <div className="space-y-1.5">
                {(clases[d] || []).map((cl, i) => (
                  <div
                    key={i}
                    className={`rounded-lg ${cl.c} px-1.5 py-2 text-center shadow-sm`}
                  >
                    <p className="text-[9px] font-bold opacity-70">{cl.t}</p>
                    <p className="truncate text-[11px] font-bold">{cl.n}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

function FinanzasMockup() {
  const alumnos = [
    { n: "Joaquín R.", m: "$6.500", estado: "Pagó", ok: true },
    { n: "Mía P.", m: "$13.000", estado: "Debe", ok: false },
    { n: "Santi G.", m: "$6.500", estado: "Pagó", ok: true },
    { n: "Lola V.", m: "$26.000", estado: "Abono", ok: true },
  ];

  return (
    <BrowserFrame url="trazosdemaestra.com.ar/finanzas">
      <div className="p-4">
        <div className="mb-3 rounded-xl bg-success-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-success-700">
            Este mes
          </p>
          <p className="font-serif text-2xl font-semibold text-surface-900">$184.500</p>
        </div>
        <div className="space-y-2">
          {alumnos.map((a) => (
            <div
              key={a.n}
              className="flex items-center justify-between rounded-xl border border-surface-100 bg-white p-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-100 text-[11px] font-bold text-surface-600">
                  {a.n[0]}
                </span>
                <span className="text-sm font-bold text-surface-800">{a.n}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-surface-900">{a.m}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    a.ok
                      ? "bg-success-100 text-success-700"
                      : "bg-danger-100 text-danger-600"
                  }`}
                >
                  {a.estado}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

function TizaPlanMockup() {
  return (
    <BrowserFrame url="trazosdemaestra.com.ar/agenda">
      <div className="p-4">
        <div className="rounded-2xl border border-surface-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-surface-400">
                Plan de Tiza
              </p>
              <p className="text-sm font-bold text-surface-900">Santi · Fracciones</p>
            </div>
          </div>

          <div className="mb-3 rounded-xl bg-primary-50/60 p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-primary-600" />
              <span className="text-[10px] font-black uppercase tracking-wide text-primary-700">
                Objetivo
              </span>
            </div>
            <p className="text-xs leading-snug text-surface-700">
              Que Santi sume y reste fracciones con distinto denominador.
            </p>
          </div>

          <div className="space-y-2">
            {[
              { t: "Apertura", m: "10 min" },
              { t: "Desarrollo", m: "35 min" },
              { t: "Cierre", m: "15 min" },
            ].map((m) => (
              <div
                key={m.t}
                className="flex items-center justify-between rounded-lg border border-surface-100 px-3 py-2"
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-surface-800">
                  <Clock className="h-3 w-3 text-surface-400" />
                  {m.t}
                </span>
                <span className="text-[10px] font-bold text-surface-400">{m.m}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-surface-50 px-3 py-2">
            <Home className="h-3 w-3 text-surface-400" />
            <span className="text-[11px] text-surface-600">
              Tarea: 5 ejercicios de fracciones
            </span>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

function ReporteMockup() {
  return (
    <BrowserFrame url="trazosdemaestra.com.ar/alumnos">
      <div className="p-4">
        <div className="rounded-2xl border border-surface-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 border-b border-surface-100 pb-3">
            <FileText className="h-4 w-4 text-primary-600" />
            <div>
              <p className="font-serif text-base font-semibold text-surface-900">
                Informe de mayo
              </p>
              <p className="text-[11px] text-surface-500">Valentina · 4° grado</p>
            </div>
          </div>
          <div className="space-y-2 text-xs leading-relaxed text-surface-600">
            <p>
              Valentina trabajó muy bien este mes. Avanzó en{" "}
              <span className="font-semibold text-surface-800">comprensión lectora</span>{" "}
              y mostró más seguridad al resolver consignas.
            </p>
            <p>
              Vimos 4 temas en 6 clases. Para junio seguimos reforzando la
              redacción de textos cortos.
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <span className="rounded-full bg-success-100 px-2.5 py-1 text-[10px] font-bold text-success-700">
              6 clases
            </span>
            <span className="rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-bold text-primary-700">
              Promedio 4.3
            </span>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}
