import Link from "next/link";
import { Users, User, AlertCircle, ChevronRight, Check } from "lucide-react";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";

export interface DeudorItem {
  kind: "alumno" | "familia";
  id: string;
  nombre: string;
  saldo: number;
}

interface Props {
  total: number;
  top: DeudorItem[];
}

/**
 * Card destacada en /finanzas: cuánto te deben en total + top 5 deudores
 * (mezcla alumnos sueltos y familias). Reemplaza el contador genérico
 * "Pendientes: N" que era engañoso porque no incluía deuda real, solo
 * pagos con estado "pendiente".
 */
export default function DeudoresCard({ total, top }: Props) {
  if (total <= 0 || top.length === 0) {
    return (
      <div className="rounded-2xl border border-success-200 bg-gradient-to-r from-success-50 to-emerald-50 p-5 shadow-sm flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-success-100 text-success-600">
          <Check size={22} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-surface-900">Todos al día</p>
          <p className="text-xs text-surface-500 mt-0.5">
            No hay saldos pendientes. Cuando alguien te deba algo, va a aparecer acá.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-warning-200 bg-gradient-to-br from-warning-50 to-amber-50 shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 px-5 pt-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warning-100 text-warning-600">
          <AlertCircle size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-warning-700">
            Te deben
          </p>
          <p className="text-2xl sm:text-3xl font-black text-surface-900 leading-tight mt-0.5">
            {formatearMonto(total)}
          </p>
          <p className="text-xs text-surface-500 mt-1">
            {top.length === 1
              ? "1 cuenta con saldo pendiente"
              : `${top.length} cuentas con saldo pendiente`}
          </p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-warning-100 border-t border-warning-100">
        {top.map((d) => (
          <Link
            key={`${d.kind}-${d.id}`}
            href="/finanzas/cuentas"
            className="flex items-center justify-between px-5 py-3 hover:bg-warning-100/40 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              {d.kind === "familia" ? (
                <Users size={14} className="text-warning-600 shrink-0" />
              ) : (
                <User size={14} className="text-warning-600 shrink-0" />
              )}
              <span className="text-sm font-semibold text-surface-900 truncate">
                {d.nombre}
                {d.kind === "familia" && (
                  <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-warning-700">
                    familia
                  </span>
                )}
              </span>
            </div>
            <span className="text-sm font-extrabold text-warning-700 shrink-0">
              {formatearMonto(d.saldo)}
            </span>
          </Link>
        ))}
      </div>

      <Link
        href="/finanzas/cuentas"
        className="flex items-center justify-center gap-1 border-t border-warning-100 bg-white/40 px-5 py-3 text-xs font-bold text-warning-800 hover:bg-white/60 transition-colors"
      >
        Ver todas las cuentas <ChevronRight size={14} />
      </Link>
    </div>
  );
}
