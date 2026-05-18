import Link from "next/link";
import { BookOpen, Sparkles, Wallet, ChevronRight, PenTool, Coffee, UserCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fdfcfa] text-[var(--color-surface-900)] overflow-hidden">
      {/* Fondo de hojas rayadas sutil */}
      <div className="fixed inset-0 trazos-notebook opacity-50 z-[-1]"></div>

      {/* Navbar simple */}
      <header className="fixed top-0 w-full z-50 px-6 py-4 flex items-center justify-between glass border-b border-[var(--color-surface-200)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-600)] flex items-center justify-center text-white shadow-sm rotate-[-3deg]">
            <PenTool className="w-4 h-4" />
          </div>
          <span className="font-bold text-xl tracking-tight text-[var(--color-surface-800)]">Trazos</span>
        </div>
        <Link
          href="/dashboard"
          className="px-5 py-2 text-sm font-bold border-2 border-[var(--color-surface-900)] text-[var(--color-surface-900)] rounded-full hover:bg-[var(--color-surface-900)] hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
        >
          Ir a mi cuaderno
        </Link>
      </header>

      <main className="pt-32 pb-20 px-6 sm:px-8 max-w-5xl mx-auto space-y-32">
        {/* Hero Organico */}
        <section className="flex flex-col md:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 space-y-6 animate-fade-in-up z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#fef3c7] text-[#d97706] text-xs font-bold uppercase tracking-wider rounded-md border border-[#fde68a] rotate-[-2deg]">
              <Coffee className="w-3 h-3" />
              <span>Hecho por y para profes</span>
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight">
              Dar clases particulares es un caos. <br />
              <span className="trazos-heading text-[var(--color-primary-700)]">Trazos es tu cuaderno en limpio.</span>
            </h1>
            
            <p className="text-xl text-[var(--color-surface-700)] leading-relaxed max-w-lg mt-6 font-medium">
              Olvidate de renegar buscando en qué tema se quedó cada alumno o tratando de acordarte si la clase del martes te la pagaron. <br/><br/>
              Anotá todo acá, y de paso, <span className="trazos-highlight font-bold text-[var(--color-surface-900)]">te armamos la tarea con IA</span> para que no pierdas tiempo.
            </p>
            
            <div className="pt-8 flex flex-col sm:flex-row gap-4 items-start">
              <Link
                href="/dashboard"
                className="group relative inline-flex items-center gap-2 px-8 py-4 bg-[var(--color-primary-600)] text-white rounded-xl font-bold text-lg transition-all hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(20,184,166,0.5)]"
              >
                <span>Abrir mi cuaderno</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Collage a la derecha (estilo escritorio) */}
          <div className="flex-1 w-full max-w-md relative min-h-[400px]">
            {/* Elemento 1: Post-it */}
            <div className="absolute top-0 right-10 w-48 bg-[#fefce8] p-4 shadow-md rotate-[4deg] border border-[#fef9c3] z-20 animate-float">
              <div className="w-full h-2 bg-yellow-200/50 absolute top-0 left-0"></div>
              <p className="font-bold text-sm text-[#854d0e] mb-2">Santi - Jueves 17hs</p>
              <p className="text-xs text-[#a16207]">Faltó la clase pasada. Hay que repasar fracciones porque tiene prueba el lunes!! 😱</p>
            </div>

            {/* Elemento 2: Ticket de pago */}
            <div className="absolute bottom-10 left-0 w-56 bg-white p-4 shadow-lg -rotate-[6deg] rounded-lg border-l-4 border-l-[var(--color-success-400)] z-10 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-[var(--color-surface-500)]">TRANSFERENCIA</span>
                <span className="text-xs font-bold text-[var(--color-success-500)]">PAGADO</span>
              </div>
              <p className="font-bold text-lg">$6.500</p>
              <p className="text-xs text-[var(--color-surface-500)]">Clase de Inglés - Mía</p>
            </div>

            {/* Elemento 3: Tarea generada */}
            <div className="absolute top-20 left-10 w-64 bg-white p-5 shadow-xl rotate-[2deg] rounded-2xl border border-[var(--color-primary-100)] z-30 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
              <div className="flex items-center gap-2 mb-3 text-[var(--color-primary-600)] bg-[var(--color-primary-50)] w-fit px-2 py-1 rounded">
                <Sparkles className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase">Ejercicio generado</span>
              </div>
              <p className="text-sm font-bold mb-2 leading-tight">Completá las oraciones con Past Simple:</p>
              <div className="space-y-2 text-xs text-[var(--color-surface-600)]">
                <p>1. Yesterday, I ____ (go) to the park.</p>
                <p>2. She ____ (not/eat) pizza for dinner.</p>
                <p className="mt-2 text-[var(--color-primary-600)] font-medium">✨ Ver 3 ejercicios más...</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features en formato tarjetas desordenadas */}
        <section className="space-y-16">
          <div className="text-center space-y-3 mb-12">
            <h2 className="text-3xl font-extrabold trazos-gradient-text inline-block">Chau a las mil planillas</h2>
            <p className="text-lg text-[var(--color-surface-600)]">Pensado para solucionar lo que realmente nos hace perder tiempo.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-10">
            {/* Tarjeta 1 */}
            <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[var(--color-surface-100)] rotate-[-1deg] hover:rotate-0 transition-transform hover:shadow-lg relative group">
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center text-[var(--color-primary-600)] group-hover:scale-110 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-xl font-bold mb-3">El salvavidas para la tarea</h3>
              <p className="text-[var(--color-surface-600)] leading-relaxed">
                Vos anotás "vimos fracciones equivalentes" y la IA te arma 5 ejercicios a medida. Lo copiás, lo mandás por WhatsApp y te olvidás.
              </p>
            </div>

            {/* Tarjeta 2 */}
            <div className="bg-[#fefce8] p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#fef9c3] rotate-[2deg] hover:rotate-0 transition-transform hover:shadow-lg relative group mt-4 md:mt-0">
              <div className="trazos-tape !left-1/2 !-translate-x-1/2 !w-16 !top-[-10px] !bg-yellow-400 !opacity-50"></div>
              <h3 className="text-xl font-bold mb-3 mt-2 text-[#854d0e]">¿Me pagó o no me pagó?</h3>
              <p className="text-[#a16207] leading-relaxed">
                Fin del misterio. Anotá quién te debe, quién te transfirió ayer, y mirá de reojo cuánta plata te va a entrar este mes para poder organizarte.
              </p>
            </div>

            {/* Tarjeta 3 */}
            <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[var(--color-surface-100)] rotate-[-2deg] hover:rotate-0 transition-transform hover:shadow-lg relative group md:mt-8">
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[var(--color-success-100)] flex items-center justify-center text-[var(--color-success-600)] group-hover:scale-110 transition-transform">
                <UserCheck className="w-4 h-4" />
              </div>
              <h3 className="text-xl font-bold mb-3">La ficha de cada alumno</h3>
              <p className="text-[var(--color-surface-600)] leading-relaxed">
                El historial de qué temas le cuestan más a Santi y qué ejercicios ya hizo Mía. Para que no repitas la misma clase dos veces por no acordarte.
              </p>
            </div>
          </div>
        </section>

        {/* Sugerencias y Soporte */}
        <section className="bg-white rounded-3xl p-8 md:p-12 shadow-[0_8px_40px_rgb(0,0,0,0.06)] border border-[var(--color-surface-100)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Sparkles className="w-32 h-32 text-[var(--color-primary-600)]" />
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold flex items-center gap-3">
                <span className="trazos-highlight">¿Tenés alguna idea?</span>
              </h2>
              <p className="text-[var(--color-surface-600)] text-lg leading-relaxed">
                Trazos está creciendo y me encantaría saber qué te gustaría que haga. ¿Falta alguna materia? ¿Tenés un problema con un cobro? ¿Alguna sugerencia para mejorar la IA?
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-4">
                <a 
                  href="mailto:trazosdemaestra@gmail.com" 
                  className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[var(--color-surface-900)] text-white font-bold hover:bg-[var(--color-primary-600)] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  Enviar sugerencia por mail
                </a>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-[#fdfcfa] p-6 rounded-2xl border border-[var(--color-surface-100)] shadow-sm">
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">?</span>
                  ¿Es realmente gratis?
                </h3>
                <p className="text-sm text-[var(--color-surface-500)]">
                  Sí, la versión base de Trazos es totalmente gratis. También ofrecemos un plan Premium para docentes con muchos alumnos.
                </p>
              </div>
              
              <div className="bg-[#fdfcfa] p-6 rounded-2xl border border-[var(--color-surface-100)] shadow-sm">
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">?</span>
                  ¿Puedo usarlo desde el celu?
                </h3>
                <p className="text-sm text-[var(--color-surface-500)]">
                  ¡Obvio! Está pensado para que anotes las clases mientras estás con el alumno, ya sea desde la compu, tablet o celular.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Descontracturado */}
        <section className="py-16 text-center border-t-2 border-dashed border-[var(--color-surface-200)] relative">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold">Guardá los Excel y venite a probarlo.</h2>
            <p className="text-[var(--color-surface-600)] text-lg">
              Literalmente tardás menos de un minuto en armar tu primera clase.
            </p>
            <div className="pt-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--color-surface-900)] text-white rounded-full font-bold text-lg hover:bg-[var(--color-primary-600)] transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1 transform duration-200"
              >
                <PenTool className="w-5 h-5" />
                <span>Empezar a organizar mis clases</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 text-center text-[var(--color-surface-500)] text-sm pb-12 flex flex-col items-center gap-3">
        <p>Hecho con ❤️, café y paciencia en Argentina.</p>
        <Link href="/privacidad" className="font-medium text-[var(--color-surface-400)] hover:text-[var(--color-primary-600)] transition-colors underline decoration-[var(--color-surface-200)] underline-offset-4">
          Política de Privacidad
        </Link>
      </footer>
    </div>
  );
}
