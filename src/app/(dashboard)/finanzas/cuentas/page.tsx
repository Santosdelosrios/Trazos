import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, ArrowLeft } from "lucide-react";
import CuentasTabs from "./CuentasTabs";
import type { SaldoFamilia, ModeloCobro } from "@/lib/types/database";

export const metadata = {
  title: "Cuentas | Trazos",
  description: "Saldos por alumno y por familia",
};

export interface AlumnoConSaldo {
  id: string;
  nombre: string;
  apellido: string;
  modelo_cobro: ModeloCobro;
  saldo_actual: number;
  tarifa_efectiva: number;
  familia_id: string | null;
  familia_nombre: string | null;
  responsable_telefono: string | null;
  familia_responsable_telefono: string | null;
  ultima_clase: string | null;
  ultimo_pago: string | null;
}

export default async function CuentasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: alumnosRaw },
    { data: familiasRaw },
    { data: familiasListaRaw },
    { data: tarifaData },
    { data: ultimasClasesRaw },
    { data: ultimosPagosRaw },
    { data: maestraData },
  ] = await Promise.all([
    supabase
      .from("alumnos")
      .select(`
        id, nombre, apellido, modelo_cobro, saldo_actual,
        tarifa_override, familia_id, responsable_telefono
      `)
      .eq("maestra_id", user.id)
      .order("apellido", { ascending: true }),

    supabase.rpc("saldos_por_familia", { p_maestra_id: user.id }),

    supabase
      .from("familias_activas")
      .select("id, nombre, responsable_telefono")
      .eq("maestra_id", user.id),

    supabase
      .from("tarifas")
      .select("valor_hora")
      .eq("maestra_id", user.id)
      .eq("activa", true)
      .order("vigente_desde", { ascending: false })
      .limit(1),

    // Última clase por alumno
    supabase
      .from("clase_alumnos")
      .select("alumno_id, clases!inner(fecha, maestra_id)")
      .eq("clases.maestra_id", user.id),

    // Último pago por alumno
    supabase
      .from("pagos")
      .select("alumno_id, fecha_pago, estado")
      .eq("maestra_id", user.id)
      .in("estado", ["pagado", "parcial"]),

    supabase.from("maestras").select("nombre").eq("id", user.id).maybeSingle(),
  ]);

  const tarifaGlobal = tarifaData?.[0]?.valor_hora ?? 0;
  const nombreMaestra = maestraData?.nombre ?? "Profe";

  // Reducir a un mapa { alumno_id → fecha más reciente }
  const ultimaClasePorAlumno = new Map<string, string>();
  for (const row of (ultimasClasesRaw ?? []) as Array<{
    alumno_id: string;
    clases: { fecha: string } | { fecha: string }[] | null;
  }>) {
    const claseRel = row.clases;
    const fecha = Array.isArray(claseRel) ? claseRel[0]?.fecha : claseRel?.fecha;
    if (!fecha) continue;
    const prev = ultimaClasePorAlumno.get(row.alumno_id);
    if (!prev || fecha > prev) ultimaClasePorAlumno.set(row.alumno_id, fecha);
  }

  const ultimoPagoPorAlumno = new Map<string, string>();
  for (const row of (ultimosPagosRaw ?? []) as Array<{
    alumno_id: string;
    fecha_pago: string | null;
  }>) {
    if (!row.fecha_pago) continue;
    const prev = ultimoPagoPorAlumno.get(row.alumno_id);
    if (!prev || row.fecha_pago > prev) ultimoPagoPorAlumno.set(row.alumno_id, row.fecha_pago);
  }

  const familiasIndex = new Map<string, { nombre: string; responsable_telefono: string | null }>();
  for (const f of (familiasListaRaw ?? []) as Array<{
    id: string; nombre: string; responsable_telefono: string | null;
  }>) {
    familiasIndex.set(f.id, { nombre: f.nombre, responsable_telefono: f.responsable_telefono });
  }

  const alumnos: AlumnoConSaldo[] = (alumnosRaw ?? []).map((a: {
    id: string; nombre: string; apellido: string;
    modelo_cobro: ModeloCobro; saldo_actual: number;
    tarifa_override: number | null; familia_id: string | null;
    responsable_telefono: string | null;
  }) => {
    const fam = a.familia_id ? familiasIndex.get(a.familia_id) ?? null : null;
    return {
      id: a.id,
      nombre: a.nombre,
      apellido: a.apellido,
      modelo_cobro: a.modelo_cobro,
      saldo_actual: Number(a.saldo_actual) || 0,
      tarifa_efectiva: a.tarifa_override ?? tarifaGlobal,
      familia_id: a.familia_id,
      familia_nombre: fam?.nombre ?? null,
      responsable_telefono: a.responsable_telefono,
      familia_responsable_telefono: fam?.responsable_telefono ?? null,
      ultima_clase: ultimaClasePorAlumno.get(a.id) ?? null,
      ultimo_pago: ultimoPagoPorAlumno.get(a.id) ?? null,
    };
  });

  const familias: SaldoFamilia[] = (familiasRaw ?? []) as SaldoFamilia[];

  return (
    <div className="animate-fade-in-up space-y-6 pb-12">
      <div>
        <Link
          href="/finanzas"
          className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:underline"
        >
          <ArrowLeft size={14} /> Volver a Finanzas
        </Link>
        <h1 className="flex items-center gap-2 trazos-heading text-2xl font-extrabold tracking-tight text-surface-900">
          Cuentas corrientes <Users size={24} className="text-primary-600" />
        </h1>
        <p className="mt-3 text-sm text-surface-500 font-medium">
          Quién te debe, quién está al día, y cuánto.
        </p>
      </div>

      <CuentasTabs
        alumnos={alumnos}
        familias={familias}
        nombreMaestra={nombreMaestra}
      />
    </div>
  );
}
