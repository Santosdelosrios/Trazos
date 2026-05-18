import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TablaCobranzas from "@/components/finanzas/TablaCobranzas";
import FormNuevoPago from "./FormNuevoPago";
import { CreditCard } from "lucide-react";

export const metadata = {
  title: "Cobranzas | Trazos",
  description: "Registro y control de cobros por clase",
};

export default async function CobranzasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch maestra name
  const { data: maestraData } = await supabase
    .from("maestras")
    .select("nombre")
    .eq("id", user.id)
    .maybeSingle();
  
  const nombreMaestra = maestraData?.nombre ?? user.user_metadata?.nombre ?? "Profe";

  // Pagos con datos del alumno
  const { data: pagos } = await supabase
    .from("pagos")
    .select("*, alumnos(nombre, apellido)")
    .eq("maestra_id", user.id)
    .order("created_at", { ascending: false });

  // Alumnos para el form
  const { data: alumnos } = await supabase
    .from("alumnos")
    .select("id, nombre, apellido")
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
        <h1 className="flex items-center gap-2 trazos-heading text-2xl font-extrabold tracking-tight text-surface-900">
          Cobranzas <CreditCard size={24} className="text-primary-600" />
        </h1>
        <p className="mt-3 text-sm text-surface-500 font-medium">
          Registrá y controlá los pagos de tus alumnos.
        </p>
      </div>

      <FormNuevoPago alumnos={alumnos ?? []} tarifaActual={tarifaActual} />

      <TablaCobranzas pagos={pagos ?? []} nombreMaestra={nombreMaestra} />
    </div>
  );
}
