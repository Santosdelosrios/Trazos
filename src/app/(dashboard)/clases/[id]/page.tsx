import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import PagoEditor from "./PagoEditor";

export const metadata = {
  title: "Detalle de Clase | Trazos",
};

export default async function DetalleClasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Obtener registro de clase_alumno
  const { data: registro, error } = await supabase
    .from("clase_alumnos")
    .select(`
      id,
      nota,
      total_correctas,
      autoevaluacion,
      respondido_at,
      ejercicios_resultados,
      clase_id,
      alumno_id,
      clases!inner (
        tema,
        fecha,
        duracion_real,
        maestra_id
      ),
      alumnos!inner (
        id,
        nombre,
        apellido
      )
    `)
    .eq("id", id)
    .eq("clases.maestra_id", user.id)
    .single();

  if (error || !registro) {
    redirect("/clases");
  }

  // 2. Obtener pago asociado
  const { data: pago } = await supabase
    .from("pagos")
    .select("monto, estado")
    .eq("clase_id", registro.clase_id)
    .eq("alumno_id", registro.alumno_id)
    .maybeSingle();

  const clase = registro.clases as any;
  const alumno = registro.alumnos as any;
  const resultados = Array.isArray(registro.ejercicios_resultados) ? registro.ejercicios_resultados : [];

  const formatSelfEval = (val: number | null) => {
    if (val === null) return "No registrada";
    if (val >= 4) return "Alta (Puede explicarlo)";
    if (val >= 3) return "Buena (Lo entendió)";
    if (val >= 2) return "Regular (En proceso)";
    return "Baja (Necesita repaso)";
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-fade-in-up pb-12">
      {/* Header & Breadcrumb */}
      <div>
        <nav className="mb-4 flex text-sm text-surface-500">
          <Link href="/clases" className="hover:text-primary-600 transition-colors">
            Historial de Clases
          </Link>
          <span className="mx-2">/</span>
          <span className="text-surface-900 font-medium">Detalle</span>
        </nav>
        
        <div className="flex items-center gap-4 rounded-2xl bg-white p-6 shadow-sm border border-surface-200">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-surface-900">
              {clase.tema}
            </h1>
            <p className="text-surface-600 flex flex-wrap items-center gap-2 mt-1">
              <Link href={`/alumnos/${alumno.id}`} className="font-semibold text-primary-600 hover:underline">
                {alumno.nombre} {alumno.apellido}
              </Link>
              <span>·</span>
              <span>{new Date(clase.fecha).toLocaleDateString("es-AR", { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tarjeta de Finanzas y Tiempo */}
        <section className="rounded-2xl bg-white p-6 shadow-sm border border-surface-200">
          <h2 className="text-lg font-bold text-surface-900 mb-4 flex items-center gap-2">
            <span>⏱️</span> Tiempo y Finanzas
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-surface-100 pb-3">
              <span className="text-surface-600 text-sm font-medium">Duración Real</span>
              <span className="font-bold text-surface-900">{clase.duracion_real} hs</span>
            </div>
            
            <PagoEditor 
              pago={pago} 
              claseId={registro.clase_id} 
              alumnoId={registro.alumno_id} 
              claseAlumnoId={id}
            />
          </div>
        </section>

        {/* Tarjeta de Desempeño */}
        <section className="rounded-2xl bg-white p-6 shadow-sm border border-surface-200">
          <h2 className="text-lg font-bold text-surface-900 mb-4 flex items-center gap-2">
            <span>🎯</span> Desempeño General
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-surface-100 pb-3">
              <span className="text-surface-600 text-sm font-medium">Nota Final</span>
              <span className={cn(
                "inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold",
                (registro.nota ?? 0) >= 4 ? "bg-success-100 text-success-700" :
                (registro.nota ?? 0) >= 2.5 ? "bg-warning-100 text-warning-800" :
                "bg-danger-100 text-danger-700"
              )}>
                {registro.nota ?? "N/A"}/5
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-surface-100 pb-3">
              <span className="text-surface-600 text-sm font-medium">Respuestas Correctas</span>
              <span className="font-bold text-surface-900">{registro.total_correctas} de {resultados.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-surface-600 text-sm font-medium">Autoevaluación Alumno</span>
              <span className="font-bold text-surface-900 text-sm">
                {formatSelfEval(registro.autoevaluacion)}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Detalle de Preguntas */}
      <section className="rounded-2xl bg-white p-6 shadow-sm border border-surface-200">
         <h2 className="text-lg font-bold text-surface-900 mb-6 flex items-center gap-2">
            <span>📝</span> Detalle del Ejercicio
          </h2>
          
          {resultados.length === 0 ? (
            <p className="text-surface-500 text-sm italic">No hay detalles de las respuestas guardados.</p>
          ) : (
            <div className="space-y-6">
              {resultados.map((res: any, index: number) => (
                <div key={index} className="rounded-xl border border-surface-100 bg-surface-50 p-5">
                  <div className="flex gap-3 items-start mb-3">
                    <span className={cn(
                      "flex-shrink-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white",
                      res.es_correcta ? "bg-success-500" : "bg-danger-500"
                    )}>
                      {res.es_correcta ? "✓" : "✗"}
                    </span>
                    <p className="text-sm font-medium text-surface-900 leading-relaxed">
                      {res.consigna}
                    </p>
                  </div>
                  
                  <div className="ml-9 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-white p-3 border border-surface-200">
                      <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-1">
                        Respuesta del alumno
                      </p>
                      <p className={cn(
                        "text-sm font-medium",
                        res.es_correcta ? "text-success-700" : "text-danger-700"
                      )}>
                        {res.respuesta_alumno}
                      </p>
                    </div>
                    
                    {!res.es_correcta && (
                      <div className="rounded-lg bg-success-50 p-3 border border-success-100">
                        <p className="text-[10px] font-bold text-success-600 uppercase tracking-wider mb-1">
                          Respuesta correcta
                        </p>
                        <p className="text-sm font-medium text-success-800">
                          {res.respuesta_correcta}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
      </section>
    </div>
  );
}
