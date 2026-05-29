import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { deleteAlumno } from "./actions";
import { Trash2, GraduationCap, Crown } from "lucide-react";
import { getPlan, PLAN_LIMITS } from "@/lib/plan";
import NuevoAlumnoForm from "./NuevoAlumnoForm";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = {
  title: "Mis Alumnos | Trazos",
};

export default async function AlumnosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch alumnos, plan y tarifa activa en paralelo
  const [{ data: alumnosRaw, error }, plan, { data: tarifaData }] = await Promise.all([
    supabase
      .from("alumnos")
      .select("*")
      .eq("maestra_id", user.id)
      .order("created_at", { ascending: false }),
    getPlan(supabase, user.id),
    supabase
      .from("tarifas")
      .select("valor_hora, tipo")
      .eq("maestra_id", user.id)
      .eq("activa", true)
      .order("vigente_desde", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const tarifaActual = (tarifaData as { valor_hora: number } | null)?.valor_hora ?? null;
  const tipoTarifa = ((tarifaData as { tipo?: "por_hora" | "por_clase" } | null)?.tipo) ?? "por_hora";

  if (error) {
    console.error("Error fetching alumnos:", error);
  }

  const totalAlumnos = alumnosRaw?.length || 0;
  const maxAlumnos = PLAN_LIMITS[plan].maxAlumnos;
  const atLimit = plan === "free" && totalAlumnos >= maxAlumnos;

  // Fetch ALL balances in a single batch call (avoids N+1 queries)
  const saldosMap: Record<string, number> = {};

  if (alumnosRaw && alumnosRaw.length > 0) {
    const { data: saldosBatch } = await supabase.rpc("calcular_saldos_maestra", {
      p_maestra_id: user.id,
    });
    
    if (saldosBatch && Array.isArray(saldosBatch)) {
      saldosBatch.forEach((row: { alumno_id?: string; saldo_pendiente?: number }) => {
        if (row && row.alumno_id) {
          saldosMap[row.alumno_id] = Number(row.saldo_pendiente) || 0;
        }
      });
    }
  }

  const alumnos = (alumnosRaw || []).map(alumno => ({
    ...alumno,
    saldo_pendiente: saldosMap[alumno.id] || 0,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Mis Alumnos</h1>
          <p className="text-surface-600">Administrá tu lista de estudiantes.</p>
        </div>
        {plan === "free" && (
          <div className="flex items-center gap-2 rounded-xl bg-surface-100 px-4 py-2 text-sm font-bold text-surface-700 border border-surface-200">
            <GraduationCap size={16} />
            <span>{totalAlumnos}/{maxAlumnos}</span>
          </div>
        )}
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Formulario para nuevo alumno */}
        <div className="md:col-span-1">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-surface-200">
            <h2 className="text-lg font-semibold text-surface-900 mb-4">
              Agregar Alumno
            </h2>

            {atLimit && (
              <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
                  <Crown size={16} className="text-amber-500" />
                  Límite alcanzado
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Tenés {totalAlumnos} de {maxAlumnos} alumnos en el plan gratuito. Pasá a Premium para agregar <b>sin límite</b> y hablar con <b>Tiza</b>, tu asistente virtual.
                </p>
              </div>
            )}
            <NuevoAlumnoForm atLimit={atLimit} tarifaActual={tarifaActual} tipoTarifa={tipoTarifa} />
          </div>
        </div>

        {/* Lista de alumnos */}
        <div className="md:col-span-2">
          <div className="rounded-2xl bg-white shadow-sm border border-surface-200 overflow-hidden">
            {alumnos && alumnos.length > 0 ? (
              <ul className="divide-y divide-surface-100">
                {alumnos.map((alumno) => (
                  <li key={alumno.id} className="group relative hover:bg-surface-50 transition-colors">
                    <Link href={`/alumnos/${alumno.id}`} className="block p-4 sm:p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 text-lg font-bold text-indigo-700">
                            {alumno.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-surface-900 group-hover:text-primary-600 transition-colors">
                              {alumno.nombre} {alumno.apellido}
                            </h3>
                            <div className="flex items-center space-x-2 text-sm text-surface-500">
                              <span className="inline-flex items-center rounded-md bg-surface-100 px-2 py-1 text-xs font-medium text-surface-600">
                                {alumno.grado}
                              </span>
                              {(() => {
                                const saldo = alumno.saldo_pendiente || 0;
                                const modelo = alumno.modelo_cobro || "por_clase";
                                // Para bolsa_creditos, el indicador relevante es
                                // el contador de créditos (clases), no el saldo
                                // monetario (que ahora siempre está en plata).
                                // Antes del refactor cargos/cobros, saldo_actual
                                // representaba créditos para este modelo — eso
                                // ya no es así, ahora vive en creditos_actual.
                                const creditos = Number(alumno.creditos_actual) || 0;

                                if (modelo === "bolsa_creditos") {
                                  if (creditos > 0) {
                                    return (
                                      <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                                        {creditos} {creditos === 1 ? "clase disponible" : "clases disponibles"}
                                      </span>
                                    );
                                  } else if (creditos < 0) {
                                    const absCred = Math.abs(creditos);
                                    return (
                                      <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-800 border border-red-200">
                                        {absCred} {absCred === 1 ? "clase adeudada" : "clases adeudadas"}
                                      </span>
                                    );
                                  } else if (saldo > 0) {
                                    // Pack agotado y empezó a deber plata
                                    return (
                                      <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-800 border border-red-200">
                                        Pack agotado · debe ${saldo.toLocaleString("es-AR")}
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600 border border-gray-200">
                                        Al día
                                      </span>
                                    );
                                  }
                                } else {
                                  if (saldo > 0) {
                                    return (
                                      <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-800 border border-red-200">
                                        Deuda: ${saldo.toLocaleString("es-AR")}
                                      </span>
                                    );
                                  } else if (saldo < 0) {
                                    return (
                                      <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800 border border-blue-200">
                                        Saldo a favor: ${Math.abs(saldo).toLocaleString("es-AR")}
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600 border border-gray-200">
                                        Al día
                                      </span>
                                    );
                                  }
                                }
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                      {alumno.notas && (
                        <p className="mt-3 text-sm text-surface-600 pl-16 line-clamp-2">
                          {alumno.notas}
                        </p>
                      )}
                    </Link>

                    {/* Botón de eliminar (posicionado absoluto para no interferir con el Link) */}
                    <form action={async () => {
                      "use server";
                      await deleteAlumno(alumno.id);
                    }} className="absolute top-4 right-4 sm:top-6 sm:right-6">
                      <button
                        type="submit"
                        className="text-surface-400 hover:text-danger-500 transition-colors p-2 rounded-lg hover:bg-danger-50 opacity-0 group-hover:opacity-100"
                        title="Eliminar alumno"
                      >
                        <Trash2 size={18} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={GraduationCap}
                title="Todavía no hay alumnos"
                description="Agregá a tu primer estudiante usando el formulario de la izquierda. Te lleva menos de un minuto."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
