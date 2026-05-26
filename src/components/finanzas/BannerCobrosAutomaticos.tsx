import Link from "next/link";
import { Zap, ChevronRight } from "lucide-react";

/**
 * Banner informativo que aparece en /finanzas cuando una maestra
 * (típicamente las "beta", creadas antes de PR-2) tiene el flag de
 * cobros automáticos desactivado. La invita a activarlo desde Perfil.
 *
 * El render se condiciona desde la page padre; este componente asume
 * que ya se decidió mostrarlo.
 */
export default function BannerCobrosAutomaticos() {
  return (
    <Link
      href="/perfil"
      className="block rounded-2xl border border-primary-200 bg-gradient-to-r from-primary-50 to-accent-50 p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
          <Zap size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-surface-900">
            Activá los cobros automáticos
          </p>
          <p className="mt-1 text-xs text-surface-600 leading-relaxed">
            Hoy estás cargando los cobros a mano. Si lo activás, cada
            clase que cierres va a generar el cobro pendiente sola,
            según el modelo de cada alumno.
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary-700">
            Activar en Perfil <ChevronRight size={12} />
          </span>
        </div>
      </div>
    </Link>
  );
}
