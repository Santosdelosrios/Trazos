import Link from "next/link";
import {
  AlertTriangle, User, Clock, Calculator, TrendingDown,
  ChevronRight, Info,
  type LucideIcon,
} from "lucide-react";
import { presentarAlerta } from "@/lib/finanzas/alertas";
import type { AlertaFinanza } from "@/lib/types/database";

interface Props {
  alertas: AlertaFinanza[];
}

const ICONS: Record<string, LucideIcon> = {
  user: User,
  clock: Clock,
  calculator: Calculator,
  "trending-down": TrendingDown,
  info: Info,
};

/**
 * Panel de alertas en /finanzas. Si no hay alertas, no se muestra nada
 * (no queremos espacio vacío en el dashboard cuando todo está OK).
 */
export default function PanelAlertas({ alertas }: Props) {
  if (alertas.length === 0) return null;

  return (
    <section className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-surface-100 bg-surface-50/50 px-5 py-3 flex items-center gap-2">
        <AlertTriangle size={16} className="text-warning-500" />
        <h3 className="text-sm font-bold text-surface-900">
          Atención
        </h3>
        <span className="ml-auto inline-flex items-center justify-center rounded-full bg-warning-100 text-warning-700 px-2 py-0.5 text-[10px] font-bold">
          {alertas.length}
        </span>
      </div>
      <div className="divide-y divide-surface-100">
        {alertas.map((a, idx) => {
          const p = presentarAlerta(a);
          const Icon = ICONS[p.icono] ?? Info;
          return (
            <div
              key={`${a.tipo}-${idx}`}
              className={`flex items-start gap-3 px-5 py-4 ${p.tono.bg}`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${p.tono.iconBg} ${p.tono.iconColor}`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${p.tono.titleColor}`}>
                  {p.titulo}
                </p>
                {p.descripcion && (
                  <p className="mt-0.5 text-xs text-surface-600">
                    {p.descripcion}
                  </p>
                )}
                {p.cta && (
                  <Link
                    href={p.cta.href}
                    className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${p.tono.titleColor} hover:underline`}
                  >
                    {p.cta.label} <ChevronRight size={12} />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
