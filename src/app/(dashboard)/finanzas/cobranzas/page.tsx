import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TablaCobranzas from "@/components/finanzas/TablaCobranzas";
import CobrosSinImputar from "@/components/finanzas/CobrosSinImputar";
import type { CobroLibre } from "@/components/finanzas/CobrosSinImputar";
import FormNuevoPago from "./FormNuevoPago";
import BackLink from "@/components/ui/BackLink";
import { CreditCard } from "lucide-react";

export const metadata = {
  title: "Cobranzas | Trazos",
  description: "Registro y control de cobros por clase",
};

export default async function CobranzasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch maestra info (nombre + datos para mensajería)
  const { data: maestraData } = await supabase
    .from("maestras")
    .select("nombre, datos_pago, template_recordatorio")
    .eq("id", user.id)
    .maybeSingle();

  const nombreMaestra = maestraData?.nombre ?? user.user_metadata?.nombre ?? "Profe";
  const datosPago = maestraData?.datos_pago ?? null;
  const templateRecordatorio = maestraData?.template_recordatorio ?? null;

  // Pagos (cargos con estado derivado) — sin embedded join para
  // evitar que PostgREST falle al inferir FKs desde la vista.
  // Los datos del alumno se resuelven en una query separada y se
  // mergen en memoria.
  const [
    { data: pagosRaw },
    { data: cobrosLibresRaw },
    { data: alumnosRaw },
  ] = await Promise.all([
    supabase
      .from("pagos_activos")
      .select("*")
      .eq("maestra_id", user.id)
      .order("created_at", { ascending: false }),

    // Cobros sin imputación (saldo a favor del alumno).
    supabase
      .from("cobros_libres_activos")
      .select("id, alumno_id, monto, monto_libre, fecha, medio_pago, nota")
      .eq("maestra_id", user.id)
      .order("fecha", { ascending: false }),

    // Alumnos con su familia (para resolver responsable + teléfono)
    supabase
      .from("alumnos")
      .select(`
        id, nombre, apellido,
        responsable_nombre, responsable_telefono,
        familia:familias!alumnos_familia_id_fkey (
          responsable_nombre, responsable_telefono
        )
      `)
      .eq("maestra_id", user.id),
  ]);

  // Merge: agregar los datos del alumno a cada pago y cobro libre
  const alumnosMap = new Map(
    (alumnosRaw ?? []).map((a) => [a.id, a])
  );
  const pagos = (pagosRaw ?? []).map((p) => ({
    ...p,
    alumnos: alumnosMap.get(p.alumno_id) ?? undefined,
  }));
  const cobrosLibres: CobroLibre[] = (cobrosLibresRaw ?? []).map((c) => {
    const al = alumnosMap.get(c.alumno_id);
    return {
      id: c.id as string,
      alumno_id: c.alumno_id as string,
      monto: Number(c.monto),
      monto_libre: Number(c.monto_libre),
      fecha: c.fecha as string,
      medio_pago: c.medio_pago as CobroLibre["medio_pago"],
      nota: c.nota as string | null,
      alumnos: al ? { nombre: al.nombre, apellido: al.apellido } : undefined,
    };
  });

  // Alumnos para el form (con modelo de cobro)
  const { data: alumnos } = await supabase
    .from("alumnos")
    .select("id, nombre, apellido, modelo_cobro")
    .eq("maestra_id", user.id)
    .order("apellido");

  // Tarifa activa
  const { data: tarifaData } = await supabase
    .from("tarifas")
    .select("valor_hora")
    .eq("maestra_id", user.id)
    .eq("activa", true)
    .order("vigente_desde", { ascending: false })
    .limit(1);

  const tarifaActual = tarifaData?.[0]?.valor_hora ?? 0;

  return (
    <div className="animate-fade-in-up space-y-6 pb-12">
      <div>
        <BackLink href="/finanzas" label="Volver a Finanzas" />
        <h1 className="flex items-center gap-2 trazos-heading text-2xl font-extrabold tracking-tight text-surface-900">
          Cobranzas <CreditCard size={24} className="text-primary-600" />
        </h1>
        <p className="mt-3 text-sm text-surface-500 font-medium">
          Registrá y controlá los pagos de tus alumnos.
        </p>
      </div>

      <FormNuevoPago alumnos={alumnos ?? []} tarifaActual={tarifaActual} />

      <CobrosSinImputar cobros={cobrosLibres} />

      <TablaCobranzas
        pagos={pagos}
        nombreMaestra={nombreMaestra}
        templateRecordatorio={templateRecordatorio}
        datosPago={datosPago}
      />
    </div>
  );
}
