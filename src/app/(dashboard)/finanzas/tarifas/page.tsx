import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CalculadoraTarifa from "@/components/finanzas/CalculadoraTarifa";
import { Calculator } from "lucide-react";

export const metadata = {
  title: "Tarifas | Trazos",
  description: "Calculadora de valor hora y gestión de tarifas",
};

export default async function TarifasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Tarifa activa
  const { data: tarifaData } = await supabase
    .from("tarifas")
    .select("valor_hora")
    .eq("maestra_id", user.id)
    .eq("activa", true)
    .order("vigente_desde", { ascending: false })
    .limit(1);

  const tarifaActual = tarifaData?.[0]?.valor_hora ?? null;

  return (
    <div className="animate-fade-in-up space-y-6 pb-12">
      <div>
        <h1 className="flex items-center gap-2 trazos-heading text-2xl font-extrabold tracking-tight text-surface-900">
          Tarifas <Calculator size={24} className="text-primary-600" />
        </h1>
        <p className="mt-3 text-sm text-surface-500 font-medium">
          Calculá tu valor hora ideal y definí la tarifa para tus clases.
        </p>
      </div>

      <CalculadoraTarifa tarifaActual={tarifaActual} />
    </div>
  );
}
