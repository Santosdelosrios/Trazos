import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import {
  CATEGORIA_GASTO_LABELS,
  type CategoriaGasto,
} from "@/lib/types/database";
import FormNuevoGasto from "./FormNuevoGasto";
import { Package, RefreshCw } from "lucide-react";
import { CategoriaGastoIcon } from "@/components/ui/CategoriaGastoIcon";

export const metadata = {
  title: "Gastos | Trazos",
  description: "Registro de gastos operativos",
};

export default async function GastosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: gastos } = await supabase
    .from("gastos")
    .select("*")
    .eq("maestra_id", user.id)
    .order("fecha", { ascending: false });

  // Total del mes
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const gastosMes = (gastos ?? []).filter(
    (g: any) => new Date(g.fecha) >= startOfMonth
  );
  const totalMes = gastosMes.reduce((sum: number, g: any) => sum + Number(g.monto), 0);

  return (
    <div className="animate-fade-in-up space-y-6 pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 trazos-heading text-2xl font-extrabold tracking-tight text-surface-900">
            Gastos <Package size={24} className="text-primary-600" />
          </h1>
          <p className="mt-3 text-sm text-surface-500 font-medium">
            Registrá tus costos operativos para calcular tu ganancia real.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
            Total este mes
          </p>
          <p className="text-2xl font-black text-danger-500">
            {formatearMonto(totalMes)}
          </p>
        </div>
      </div>

      <FormNuevoGasto />

      {/* Lista de gastos */}
      {!gastos || gastos.length === 0 ? (
        <div className="rounded-2xl border border-surface-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-100 text-surface-400">
            <Package size={32} />
          </div>
          <p className="text-sm text-surface-500">No hay gastos registrados.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-surface-100">
            {gastos.map((gasto: any) => {
              const cat = gasto.categoria as CategoriaGasto;
              return (
                <div
                  key={gasto.id}
                  className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-surface-50/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-100 text-surface-500">
                      <CategoriaGastoIcon categoria={cat} size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-surface-900">
                        {gasto.descripcion || CATEGORIA_GASTO_LABELS[cat]}
                      </p>
                      <p className="text-xs text-surface-400">
                        {CATEGORIA_GASTO_LABELS[cat]} ·{" "}
                        {new Date(gasto.fecha + "T12:00:00").toLocaleDateString("es-AR", {
                          day: "numeric",
                          month: "short",
                        })}
                        {gasto.recurrente && (
                          <span className="ml-1 flex items-center gap-1 text-primary-500 inline-flex">
                            <RefreshCw size={10} /> Recurrente
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-danger-500">
                    -{formatearMonto(gasto.monto)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
