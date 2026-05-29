import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import HistoricoCliente from "./HistoricoCliente";
import BackLink from "@/components/ui/BackLink";
import type { HistoricoMes } from "@/lib/types/database";

export const metadata = {
  title: "Histórico financiero | Trazos",
  description: "Ingresos, gastos y neto de los últimos 12 meses",
};

export default async function HistoricoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.rpc("historico_finanzas", {
    p_maestra_id: user.id,
    p_meses_atras: 12,
  });
  const historico = ((data ?? []) as HistoricoMes[]).map((m) => ({
    mes: m.mes,
    ingresos: Number(m.ingresos),
    gastos: Number(m.gastos),
    neto: Number(m.neto),
  }));

  return (
    <div className="animate-fade-in-up space-y-6 pb-12">
      <div>
        <BackLink href="/finanzas" label="Volver a Finanzas" />
        <h1 className="flex items-center gap-2 trazos-heading text-2xl font-extrabold tracking-tight text-surface-900">
          Histórico <History size={24} className="text-primary-600" />
        </h1>
        <p className="mt-3 text-sm text-surface-500 font-medium">
          Cómo evolucionaron tus ingresos, gastos y ganancia neta en los últimos 12 meses.
        </p>
      </div>

      <HistoricoCliente data={historico} />
    </div>
  );
}
