import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Política de Privacidad | Trazos",
  description: "Nuestras políticas sobre el manejo y protección de tus datos y los de tus alumnos.",
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-[#fdfcfa] text-[var(--color-surface-900)] py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up">
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--color-surface-500)] hover:text-[var(--color-primary-600)] transition-colors"
        >
          <ArrowLeft size={16} /> Volver al inicio
        </Link>

        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[var(--color-surface-200)]">
          <div className="flex items-center gap-4 mb-8 pb-8 border-b border-[var(--color-surface-100)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Política de Privacidad</h1>
              <p className="text-[var(--color-surface-500)] mt-1">Última actualización: Mayo 2026</p>
            </div>
          </div>

          <div className="space-y-8 text-[var(--color-surface-700)] leading-relaxed">
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-[var(--color-surface-900)]">1. Introducción</h2>
              <p>
                En <strong>Trazos</strong> ("nosotros", "la plataforma"), nos tomamos muy en serio la privacidad de nuestros usuarios (las maestras y docentes) y la de sus alumnos. Esta Política de Privacidad explica cómo recopilamos, usamos y protegemos la información cuando utilizás nuestra plataforma.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-[var(--color-surface-900)]">2. Datos que recopilamos</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>De la Maestra:</strong> Nombre, dirección de correo electrónico y datos de autenticación necesarios para crear tu cuenta y mantenerla segura.</li>
                <li><strong>De los Alumnos:</strong> Nombres (o apodos), nivel educativo (grado) y notas descriptivas que vos decidas cargar. Recomendamos <em>no incluir datos sensibles</em> (como DNI, apellidos completos o direcciones físicas) que no sean estrictamente necesarios para tu uso pedagógico.</li>
                <li><strong>Datos de la Clase:</strong> Temas abordados, fechas, autoevaluaciones y resúmenes generados por Inteligencia Artificial.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-[var(--color-surface-900)]">3. Uso de la Inteligencia Artificial (Google Gemini)</h2>
              <p>
                Trazos utiliza la tecnología de <strong>Google Gemini</strong> para generar ejercicios y resúmenes pedagógicos. 
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Los datos enviados a la IA se limitan estrictamente al tema de la clase y las respuestas a los ejercicios.</li>
                <li><strong>No compartimos los nombres reales de los alumnos</strong> ni su información personal de contacto con los proveedores de IA.</li>
                <li>La IA se utiliza exclusivamente como asistente para facilitarte el trabajo pedagógico.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-[var(--color-surface-900)]">4. Privacidad y Aislamiento de Datos (RLS)</h2>
              <p>
                Nuestra base de datos cuenta con políticas de <strong>Seguridad a Nivel de Fila (RLS)</strong> estrictas. Esto significa que está criptográficamente garantizado que:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Vos y solo vos podés acceder a la información de tus alumnos y tus clases.</li>
                <li>Ningún otro usuario o maestra en Trazos puede ver tus datos, ni siquiera por accidente.</li>
                <li>No vendemos, alquilamos ni comercializamos tu información personal ni la de tus alumnos a terceros.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-[var(--color-surface-900)]">5. Retención y Eliminación de Datos</h2>
              <p>
                Tus datos se conservarán mientras tu cuenta esté activa. Podés eliminar cualquier registro de alumno, clase o tu cuenta completa en cualquier momento desde la aplicación. Una vez eliminados, los datos se borran de forma permanente de nuestros servidores activos.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-[var(--color-surface-900)]">6. Contacto</h2>
              <p>
                Si tenés alguna duda sobre esta política o cómo manejamos la privacidad, podés contactarnos enviando un mail a: <a href="mailto:trazosdemaestra@gmail.com" className="font-bold text-[var(--color-primary-600)] hover:underline">trazosdemaestra@gmail.com</a>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
