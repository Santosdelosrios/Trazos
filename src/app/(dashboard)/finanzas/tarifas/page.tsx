import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CalculadoraTarifa from "@/components/finanzas/CalculadoraTarifa";
import SugerenciaTarifaCard from "@/components/finanzas/SugerenciaTarifaCard";
import BackLink from "@/components/ui/BackLink";
import { Calculator } from "lucide-react";
import { getPlan } from "@/lib/plan";
import { mesesEntreFechas } from "@/lib/finanzas/inflacion";

export const metadata = {
  title: "Tarifas | Trazos",
  description: "Calculadora de valor hora y gestión de tarifas",
};

export default async function TarifasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: tarifaData },
    { data: ultimoMesRaw },
    plan,
  ] = await Promise.all([
    supabase
      .from("tarifas")
      .select("valor_hora, vigente_desde, tipo")
      .eq("maestra_id", user.id)
      .eq("activa", true)
      .order("vigente_desde", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase.rpc("ultimo_mes_inflacion"),

    getPlan(supabase, user.id),
  ]);

  const tarifaActual = tarifaData?.valor_hora ?? null;
  const vigenteDesde = tarifaData?.vigente_desde ?? null;
  const tipoActual = (tarifaData?.tipo as "por_hora" | "por_clase" | undefined) ?? "por_hora";

  // Calculamos la inflación acumulada solo si hay tarifa y fecha
  let inflacionAcumulada = 0;
  if (vigenteDesde) {
    const { data: acum } = await supabase.rpc("inflacion_acumulada", {
      p_desde: vigenteDesde,
    });
    inflacionAcumulada = Number(acum) || 0;
  }
  const meses = vigenteDesde ? mesesEntreFechas(vigenteDesde) : 0;
  const ultimoMesDatos = (ultimoMesRaw as string | null) ?? null;

  return (
    <div className="animate-fade-in-up space-y-6 pb-12">
      <div>
        <BackLink href="/finanzas" label="Volver a Finanzas" />
        <h1 className="flex items-center gap-2 trazos-heading text-2xl font-extrabold tracking-tight text-surface-900">
          Tarifas <Calculator size={24} className="text-primary-600" />
        </h1>
        <p className="mt-3 text-sm text-surface-500 font-medium">
          Calculá tu valor hora ideal y definí la tarifa para tus clases.
        </p>
      </div>

      <SugerenciaTarifaCard
        tarifaActual={tarifaActual}
        inflacionAcumulada={inflacionAcumulada}
        meses={meses}
        ultimoMesDatos={ultimoMesDatos}
        esPremium={plan === "premium"}
      />

      <CalculadoraTarifa tarifaActual={tarifaActual} tipoActual={tipoActual} />
    </div>
  );
}
