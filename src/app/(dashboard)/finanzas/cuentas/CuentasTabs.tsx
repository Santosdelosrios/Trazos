"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Users, User, MessageSquare, CreditCard,
  ChevronDown, ChevronRight, AlertCircle, Check,
} from "lucide-react";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import { MODELO_COBRO_CONFIG } from "@/lib/types/database";
import { recordatorioPago, renderizarRecordatorio, generarLinkWhatsApp } from "@/lib/finanzas/plantillasWhatsApp";
import EmptyState from "@/components/ui/EmptyState";
import type { SaldoFamilia, ModeloCobro, DetalleFamiliaItem } from "@/lib/types/database";
import type { AlumnoConSaldo } from "./page";
import { createClient } from "@/lib/supabase/client";

const MODELOS_DEUDA: ModeloCobro[] = ["por_clase", "abono_mensual", "cuenta_corriente"];

interface Props {
  alumnos: AlumnoConSaldo[];
  familias: SaldoFamilia[];
  nombreMaestra: string;
  templateRecordatorio?: string | null;
  datosPago?: string | null;
}

type Tab = "alumnos" | "familias";

export default function CuentasTabs({
  alumnos, familias, nombreMaestra, templateRecordatorio, datosPago,
}: Props) {
  const [tab, setTab] = useState<Tab>("alumnos");

  // Cuento deudores por tab para badges
  const deudoresAlumnos = useMemo(
    () => alumnos.filter((a) => MODELOS_DEUDA.includes(a.modelo_cobro) && a.saldo_actual > 0).length,
    [alumnos]
  );
  const deudoresFamilias = useMemo(
    () => familias.filter((f) => f.saldo_total > 0).length,
    [familias]
  );

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div role="tablist" className="inline-flex rounded-2xl bg-surface-100 p-1 shadow-inner">
        <TabButton
          active={tab === "alumnos"}
          onClick={() => setTab("alumnos")}
          icon={<User size={14} />}
          label="Por alumno"
          badge={deudoresAlumnos}
        />
        <TabButton
          active={tab === "familias"}
          onClick={() => setTab("familias")}
          icon={<Users size={14} />}
          label="Por familia"
          badge={deudoresFamilias}
        />
      </div>

      {tab === "alumnos" ? (
        <ListaAlumnos
          alumnos={alumnos}
          nombreMaestra={nombreMaestra}
          templateRecordatorio={templateRecordatorio}
          datosPago={datosPago}
        />
      ) : (
        <ListaFamilias
          familias={familias}
          alumnos={alumnos}
          nombreMaestra={nombreMaestra}
          templateRecordatorio={templateRecordatorio}
          datosPago={datosPago}
        />
      )}
    </div>
  );
}

function TabButton({
  active, onClick, icon, label, badge,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge: number }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all min-h-9 ${
        active
          ? "bg-white text-surface-900 shadow-sm"
          : "text-surface-500 hover:text-surface-700"
      }`}
    >
      {icon} {label}
      {badge > 0 && (
        <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
          active ? "bg-warning-100 text-warning-700" : "bg-surface-200 text-surface-600"
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ============================================================
// Lista por alumno
// ============================================================

function ListaAlumnos({
  alumnos, nombreMaestra, templateRecordatorio, datosPago,
}: {
  alumnos: AlumnoConSaldo[];
  nombreMaestra: string;
  templateRecordatorio?: string | null;
  datosPago?: string | null;
}) {
  if (alumnos.length === 0) {
    return (
      <EmptyState
        icon={User}
        title="Todavía no cargaste alumnos"
        description="Cuando cargues a tus alumnos, vas a ver acá sus saldos y movimientos."
        cta={{ label: "Cargar alumno", href: "/alumnos" }}
      />
    );
  }

  // Ordenar: deudores primero, luego al día, luego saldo a favor
  const ordenados = [...alumnos].sort((a, b) => {
    const da = MODELOS_DEUDA.includes(a.modelo_cobro) ? a.saldo_actual : 0;
    const db = MODELOS_DEUDA.includes(b.modelo_cobro) ? b.saldo_actual : 0;
    return db - da;
  });

  return (
    <div className="space-y-3">
      {ordenados.map((a) => (
        <CardAlumno
          key={a.id}
          alumno={a}
          nombreMaestra={nombreMaestra}
          templateRecordatorio={templateRecordatorio}
          datosPago={datosPago}
        />
      ))}
    </div>
  );
}

function CardAlumno({
  alumno, nombreMaestra, templateRecordatorio, datosPago,
}: {
  alumno: AlumnoConSaldo;
  nombreMaestra: string;
  templateRecordatorio?: string | null;
  datosPago?: string | null;
}) {
  const modeloConfig = MODELO_COBRO_CONFIG[alumno.modelo_cobro];
  const esDeudaMonetaria = MODELOS_DEUDA.includes(alumno.modelo_cobro);
  const saldo = alumno.saldo_actual;
  const debe = esDeudaMonetaria && saldo > 0;
  const aFavor = esDeudaMonetaria && saldo < 0;

  const telefono = alumno.familia_responsable_telefono ?? alumno.responsable_telefono ?? "";
  const linkWA = generarLinkWhatsApp(
    telefono,
    recordatorioPago({
      nombreMaestra,
      alumno: { nombre: alumno.nombre, apellido: alumno.apellido },
      monto: Math.max(saldo, 0),
      template: templateRecordatorio,
      datos_pago: datosPago,
    })
  );

  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${
      debe ? "border-warning-200" : "border-surface-200"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-surface-900 truncate">
            {alumno.nombre} {alumno.apellido}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${modeloConfig.bg} ${modeloConfig.color}`}>
              {modeloConfig.icon} {modeloConfig.label}
            </span>
            {alumno.familia_nombre && (
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-100 px-2 py-0.5 text-[10px] font-medium text-surface-600">
                <Users size={10} /> {alumno.familia_nombre}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-lg font-black ${
            debe ? "text-warning-600" : aFavor ? "text-success-600" : "text-surface-400"
          }`}>
            {alumno.modelo_cobro === "bolsa_creditos"
              ? `${Math.round(alumno.creditos_actual)} créd.`
              : formatearMonto(Math.abs(saldo))}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mt-0.5">
            {debe ? "Te debe" : aFavor ? "A favor" : alumno.modelo_cobro === "bolsa_creditos"
              ? (alumno.creditos_actual > 0 ? "Disponibles" : alumno.creditos_actual < 0 ? "Adeudadas" : "Pack agotado")
              : "Al día"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-surface-100 pt-4 text-[11px] text-surface-500">
        <FactoMini label="Última clase" valor={fmtFecha(alumno.ultima_clase)} />
        <FactoMini label="Último pago" valor={fmtFecha(alumno.ultimo_pago)} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={`/finanzas/cobranzas?alumnoId=${alumno.id}`}
          className="flex items-center gap-1.5 rounded-xl bg-surface-900 px-3 py-2 min-h-9 text-xs font-bold text-white hover:bg-primary-700 transition-colors"
        >
          <CreditCard size={14} /> Registrar cobro
        </Link>
        {debe && (
          <a
            href={linkWA}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 min-h-9 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <MessageSquare size={14} /> Recordar
          </a>
        )}
        <Link
          href={`/alumnos/${alumno.id}`}
          className="ml-auto flex items-center gap-1 text-xs font-bold text-primary-600 hover:underline"
        >
          Ver ficha <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}

function FactoMini({ label, valor }: { label: string; valor: string }) {
  return (
    <span>
      <span className="font-bold uppercase tracking-wider text-surface-400">{label}: </span>
      <span className="text-surface-600">{valor}</span>
    </span>
  );
}

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

// ============================================================
// Lista por familia (con expansión a desglose por alumno)
// ============================================================

function ListaFamilias({
  familias, alumnos, nombreMaestra, templateRecordatorio, datosPago,
}: {
  familias: SaldoFamilia[];
  alumnos: AlumnoConSaldo[];
  nombreMaestra: string;
  templateRecordatorio?: string | null;
  datosPago?: string | null;
}) {
  if (familias.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Todavía no creaste familias"
        description="Agrupá hermanos y hermanas en una familia para tener un único responsable y datos de pago compartidos. Lo activás desde la ficha de cada alumno."
        cta={{ label: "Ir a Alumnos", href: "/alumnos" }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {familias.map((f) => (
        <CardFamilia
          key={f.familia_id}
          familia={f}
          miembros={alumnos.filter((a) => a.familia_id === f.familia_id)}
          nombreMaestra={nombreMaestra}
          templateRecordatorio={templateRecordatorio}
          datosPago={datosPago}
        />
      ))}
    </div>
  );
}

function CardFamilia({
  familia, miembros, nombreMaestra, templateRecordatorio, datosPago,
}: {
  familia: SaldoFamilia;
  miembros: AlumnoConSaldo[];
  nombreMaestra: string;
  templateRecordatorio?: string | null;
  datosPago?: string | null;
}) {
  const [open, setOpen] = useState(familia.saldo_total > 0);
  const [detalle, setDetalle] = useState<DetalleFamiliaItem[] | null>(null);
  const [cargando, setCargando] = useState(false);

  const debe = familia.saldo_total > 0;
  const aFavor = familia.saldo_total < 0;

  const telefono = familia.responsable_telefono ?? "";

  // Armado del mensaje familiar usando el engine de templates:
  // si la maestra tiene template editado lo usa, si no cae al default
  // de familia (con desglose por alumno).
  const miembrosVars = miembros
    .filter((m) => ["por_clase", "abono_mensual", "cuenta_corriente"].includes(m.modelo_cobro))
    .map((m) => ({
      nombre_completo: `${m.nombre} ${m.apellido}`.trim(),
      subtotal: Math.max(m.saldo_actual, 0),
      // Sin acceso directo a "cuántas clases pendientes tiene" por
      // alumno acá; usamos 0 como placeholder (la maestra puede
      // editar después si le importa). Refinable en una iteración.
      clases: 0,
    }));

  const mensajeFamilia = renderizarRecordatorio({
    template: templateRecordatorio,
    esFamilia: true,
    vars: {
      nombre_alumno: familia.nombre,
      nombre_responsable: familia.responsable_nombre ?? null,
      monto: Math.max(familia.saldo_total, 0),
      datos_pago: datosPago,
      miembros_familia: miembrosVars,
    },
  });
  // Si el template default termina vacío o queda raro (porque nombreMaestra
  // no es variable), agregamos firma. nombreMaestra está disponible por si
  // la maestra editó el template para incluirla manualmente.
  void nombreMaestra;
  const linkWA = generarLinkWhatsApp(telefono, mensajeFamilia);

  async function toggleExpand() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && !detalle) {
      setCargando(true);
      const supabase = createClient();
      const { data } = await supabase.rpc("detalle_familia", { p_familia_id: familia.familia_id });
      setDetalle((data as DetalleFamiliaItem[]) ?? []);
      setCargando(false);
    }
  }

  // Fallback: si la RPC todavía no respondió, usamos el dato de la prop alumnos.
  const lineas: DetalleFamiliaItem[] = detalle ?? miembros.map((m) => ({
    alumno_id: m.id,
    nombre: m.nombre,
    apellido: m.apellido,
    modelo_cobro: m.modelo_cobro,
    saldo_actual: m.saldo_actual,
    tarifa_efectiva: m.tarifa_efectiva,
  }));

  // Lookup de creditos_actual por alumno_id. La RPC detalle_familia
  // todavía no devuelve este campo; lo resolvemos desde la prop
  // miembros (que sí lo tiene) para bolsa_creditos.
  const creditosPorAlumno = new Map<string, number>(
    miembros.map((m) => [m.id, m.creditos_actual]),
  );

  return (
    <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${
      debe ? "border-warning-200" : "border-surface-200"
    }`}>
      <button
        onClick={toggleExpand}
        aria-expanded={open}
        className="w-full text-left p-5 hover:bg-surface-50/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-primary-600 shrink-0" />
              <p className="text-sm font-bold text-surface-900 truncate">{familia.nombre}</p>
            </div>
            <p className="mt-1 text-xs text-surface-500">
              {familia.cant_alumnos} {familia.cant_alumnos === 1 ? "alumno" : "alumnos"}
              {familia.responsable_nombre && ` · Responsable: ${familia.responsable_nombre}`}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className={`text-lg font-black ${
                debe ? "text-warning-600" : aFavor ? "text-success-600" : "text-surface-400"
              }`}>
                {formatearMonto(Math.abs(familia.saldo_total))}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mt-0.5 flex items-center gap-0.5 justify-end">
                {debe && <AlertCircle size={10} className="text-warning-500" />}
                {!debe && !aFavor && <Check size={10} className="text-success-500" />}
                {debe ? "Te deben" : aFavor ? "A favor" : "Al día"}
              </p>
            </div>
            {open ? <ChevronDown size={16} className="text-surface-400" /> : <ChevronRight size={16} className="text-surface-400" />}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-surface-500">
          <FactoMini label="Última clase" valor={fmtFecha(familia.ultima_clase)} />
          <FactoMini label="Último pago" valor={fmtFecha(familia.ultimo_pago)} />
        </div>
      </button>

      {open && (
        <div className="border-t border-surface-100 bg-surface-50/40 px-5 py-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
            Desglose por alumno
          </p>
          {cargando && lineas.length === 0 ? (
            <p className="text-xs text-surface-400">Cargando desglose…</p>
          ) : (
            <div className="space-y-2">
              {lineas.map((l) => {
                const modeloConfig = MODELO_COBRO_CONFIG[l.modelo_cobro];
                const esDeuda = MODELOS_DEUDA.includes(l.modelo_cobro);
                const lineaDebe = esDeuda && l.saldo_actual > 0;
                return (
                  <Link
                    key={l.alumno_id}
                    href={`/alumnos/${l.alumno_id}`}
                    className="flex items-center justify-between rounded-xl bg-white border border-surface-200 px-3 py-2.5 hover:border-primary-300 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-surface-900 truncate">
                        {l.nombre} {l.apellido}
                      </p>
                      <p className="text-[10px] text-surface-500">
                        {modeloConfig.icon} {modeloConfig.label}
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${
                      lineaDebe ? "text-warning-600" : esDeuda && l.saldo_actual < 0 ? "text-success-600" : "text-surface-500"
                    }`}>
                      {l.modelo_cobro === "bolsa_creditos"
                        ? `${Math.round(creditosPorAlumno.get(l.alumno_id) ?? 0)} créd.`
                        : formatearMonto(Math.abs(l.saldo_actual))}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-surface-100">
            <Link
              href="/finanzas/cobranzas"
              className="flex items-center gap-1.5 rounded-xl bg-surface-900 px-3 py-2 min-h-9 text-xs font-bold text-white hover:bg-primary-700 transition-colors"
            >
              <CreditCard size={14} /> Registrar cobro
            </Link>
            {debe && telefono && (
              <a
                href={linkWA}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 min-h-9 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <MessageSquare size={14} /> Recordar a la familia
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
