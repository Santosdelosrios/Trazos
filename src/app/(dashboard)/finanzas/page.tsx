import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import ResumenFinanciero from "@/components/finanzas/ResumenFinanciero";
import DeudoresCard from "@/components/finanzas/DeudoresCard";
import BannerCobrosAutomaticos from "@/components/finanzas/BannerCobrosAutomaticos";
import type { ResumenFinancieroMes, EstadoPago, ModeloCobro } from "@/lib/types/database";
import { ESTADO_PAGO_CONFIG } from "@/lib/types/database";
import { Wallet, CreditCard, Package, Calculator, ChevronRight, Users } from "lucide-react";

const MODELOS_DEUDA_MONETARIA: ModeloCobro[] = ["por_clase", "abono_mensual", "cuenta_corriente"];

export const metadata = {
  title: "Finanzas | Trazos",
  description: "Dashboard financiero: ingresos, gastos y cobranzas",
};

export default async function FinanzasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Parallelize all data fetching
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    { data: resumenData },
    { data: ultimosPagos },
    { data: tarifaData },
    { data: gastosData },
    { data: deudoresAlumnosRaw },
    { data: deudoresFamiliasRaw },
    { data: maestraFlags },
  ] = await Promise.all([
    // Resumen del mes via RPC
    supabase.rpc("resumen_financiero_mes", { p_maestra_id: user.id }),

    // Últimos 5 pagos (vista filtra soft-deleted)
    supabase
      .from("pagos_activos")
      .select("id, monto, estado, fecha_pago, created_at, alumnos(nombre, apellido)")
      .eq("maestra_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),

    // Tarifa activa
    supabase
      .from("tarifas")
      .select("valor_hora")
      .eq("maestra_id", user.id)
      .eq("activa", true)
      .order("vigente_desde", { ascending: false })
      .limit(1),

    // Gastos del mes (vista filtra soft-deleted)
    supabase
      .from("gastos_activos")
      .select("id, categoria, descripcion, monto, fecha")
      .eq("maestra_id", user.id)
      .gte("fecha", startOfMonth.toISOString().split("T")[0])
      .order("fecha", { ascending: false })
      .limit(5),

    // Alumnos con saldo > 0 (deuda monetaria) y SIN familia
    supabase
      .from("alumnos")
      .select("id, nombre, apellido, modelo_cobro, saldo_actual, familia_id")
      .eq("maestra_id", user.id)
      .in("modelo_cobro", MODELOS_DEUDA_MONETARIA)
      .gt("saldo_actual", 0),

    // Saldos por familia (RPC ya filtra modelos de deuda)
    supabase.rpc("saldos_por_familia", { p_maestra_id: user.id }),

    // Flag de cobros automáticos para decidir si mostrar el banner
    supabase
      .from("maestras")
      .select("cobros_automaticos_clases")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const mostrarBannerCobrosAuto = maestraFlags?.cobros_automaticos_clases === false;

  const resumen: ResumenFinancieroMes | null = resumenData?.[0] ?? null;
  const tarifaActual = tarifaData?.[0]?.valor_hora ?? null;

  // Armar top deudores: combinamos familias (1 fila) + alumnos sueltos
  const deudoresAlumnos = (deudoresAlumnosRaw ?? []) as Array<{
    id: string; nombre: string; apellido: string;
    modelo_cobro: ModeloCobro; saldo_actual: number; familia_id: string | null;
  }>;
  const deudoresSueltos = deudoresAlumnos
    .filter((a) => !a.familia_id)
    .map((a) => ({
      kind: "alumno" as const,
      id: a.id,
      nombre: `${a.nombre} ${a.apellido}`.trim(),
      saldo: Number(a.saldo_actual) || 0,
    }));
  const deudoresFamilias = ((deudoresFamiliasRaw ?? []) as Array<{
    familia_id: string; nombre: string; saldo_total: number;
  }>)
    .filter((f) => Number(f.saldo_total) > 0)
    .map((f) => ({
      kind: "familia" as const,
      id: f.familia_id,
      nombre: f.nombre,
      saldo: Number(f.saldo_total) || 0,
    }));
  const todosDeudores = [...deudoresFamilias, ...deudoresSueltos];
  const totalAdeudado = todosDeudores.reduce((acc, d) => acc + d.saldo, 0);
  const topDeudores = todosDeudores
    .slice()
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 5);

  const subpages = [
    { href: "/finanzas/cuentas", label: "Cuentas", icon: <Users size={24} />, desc: "Saldos por alumno y familia" },
    { href: "/finanzas/cobranzas", label: "Cobranzas", icon: <CreditCard size={24} />, desc: "Registrar y controlar pagos" },
    { href: "/finanzas/gastos", label: "Gastos", icon: <Package size={24} />, desc: "Viáticos, materiales y más" },
    { href: "/finanzas/tarifas", label: "Tarifas", icon: <Calculator size={24} />, desc: "Calculá tu valor hora" },
  ];

  return (
    <div className="animate-fade-in-up space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 trazos-heading text-2xl font-extrabold tracking-tight text-surface-900">
          Finanzas <Wallet size={24} className="text-primary-600" />
        </h1>
        <p className="mt-3 text-sm text-surface-500 font-medium">
          Gestioná tus ingresos, gastos y cobranzas en un solo lugar.
        </p>
      </div>

      {/* Banner: invitación a activar cobros automáticos (solo si está apagado) */}
      {mostrarBannerCobrosAuto && <BannerCobrosAutomaticos />}

      {/* Card destacada: deudores */}
      <DeudoresCard total={totalAdeudado} top={topDeudores} />

      {/* Resumen widget */}
      <ResumenFinanciero resumen={resumen} />

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {subpages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="group relative overflow-hidden rounded-2xl border border-surface-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 opacity-10 transition-transform duration-300 group-hover:scale-150" />
            <div className="relative">
              <span className="text-2xl text-primary-600">{page.icon}</span>
              <p className="mt-3 text-base font-bold text-surface-900">
                {page.label}
              </p>
              <p className="mt-1 text-xs text-surface-500">{page.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Content grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Últimos pagos */}
        <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-surface-100 bg-surface-50/50 px-6 py-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-surface-900">Últimos Cobros</h2>
            <Link href="/finanzas/cobranzas" className="flex items-center gap-1 text-xs font-bold text-primary-600 hover:underline">
              Ver todos <ChevronRight size={14} />
            </Link>
          </div>

          {!ultimosPagos || ultimosPagos.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-surface-500">Sin cobros registrados.</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {ultimosPagos.map((pago: any) => {
                const config = ESTADO_PAGO_CONFIG[pago.estado as EstadoPago];
                return (
                  <div key={pago.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900">
                        {pago.alumnos?.nombre} {pago.alumnos?.apellido}
                      </p>
                      <p className="text-xs text-surface-400">
                        {pago.fecha_pago
                          ? new Date(pago.fecha_pago + "T12:00:00").toLocaleDateString("es-AR")
                          : "Sin fecha"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-surface-900">{formatearMonto(pago.monto)}</p>
                      <span className={`text-[10px] font-bold ${config.color}`}>{config.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info tarifa + gastos recientes */}
        <div className="space-y-4">
          {/* Tarifa card */}
          <div className="rounded-2xl border border-primary-200 bg-gradient-to-r from-primary-50 to-accent-50 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
              Tu tarifa actual
            </p>
            <p className="mt-1 text-3xl font-black text-primary-700">
              {tarifaActual ? formatearMonto(tarifaActual) : "Sin definir"}
              <span className="text-sm font-medium text-surface-400">/hora</span>
            </p>
            <Link href="/finanzas/tarifas" className="flex items-center gap-1 mt-2 inline-block text-xs font-bold text-primary-600 hover:underline">
              {tarifaActual ? "Actualizar" : "Configurar"} <ChevronRight size={14} />
            </Link>
          </div>

          {/* Gastos recientes */}
          <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-surface-900">Gastos del Mes</h3>
              <Link href="/finanzas/gastos" className="flex items-center gap-1 text-xs font-bold text-primary-600 hover:underline">
                Ver todos <ChevronRight size={14} />
              </Link>
            </div>
            {!gastosData || gastosData.length === 0 ? (
              <p className="text-xs text-surface-400">Sin gastos este mes.</p>
            ) : (
              <div className="space-y-2">
                {gastosData.map((gasto: any) => (
                  <div key={gasto.id} className="flex items-center justify-between text-xs">
                    <span className="text-surface-700">{gasto.descripcion || gasto.categoria}</span>
                    <span className="font-bold text-danger-500">-{formatearMonto(gasto.monto)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
