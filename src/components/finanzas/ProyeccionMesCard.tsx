import { TrendingUp, Check, Clock, Calendar } from "lucide-react";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import type { ProyeccionMes } from "@/lib/types/database";

interface Props {
  proyeccion: ProyeccionMes;
  /** Nombre del mes en curso ("mayo"). */
  mesNombre: string;
}

/**
 * Card de proyección del mes en /finanzas. Tres números:
 *   - Ya facturado: lo cobrado (estado pagado) este mes.
 *   - Por cobrar:   pendientes + agenda no facturada.
 *   - Proyectado:   suma de los dos anteriores. Es el "techo" del mes.
 *
 * Barra visual que muestra el progreso de cobranza (facturado / proyectado).
 * Si todo está cero, no se muestra nada (no es relevante).
 */
export default function ProyeccionMesCard({ proyeccion, mesNombre }: Props) {
  const { ya_facturado, por_cobrar, proyectado, clases_restantes } = proyeccion;

  if (proyectado <= 0) {
    return null;
  }

  const pctCobrado = proyectado > 0 ? Math.min((ya_facturado / proyectado) * 100, 100) : 0;

  return (
    <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-surface-100 bg-gradient-to-r from-primary-50 to-accent-50 px-6 py-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-surface-900 flex items-center gap-2 capitalize">
          <TrendingUp size={18} className="text-primary-600" /> Proyección de {mesNombre}
        </h3>
        {clases_restantes > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-white/60 px-2 py-0.5 text-[10px] font-bold text-primary-700">
            <Calendar size={10} /> {clases_restantes} {clases_restantes === 1 ? "clase" : "clases"} pendientes
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Barra de progreso */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-surface-600">
              Cobrado vs proyectado
            </span>
            <span className="font-bold text-surface-900">
              {pctCobrado.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-surface-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-success-400 to-success-500 h-2.5 rounded-full transition-all duration-700"
              style={{ width: `${Math.max(pctCobrado, ya_facturado > 0 ? 4 : 0)}%` }}
            />
          </div>
        </div>

        {/* Tres números */}
        <div className="grid grid-cols-3 gap-3">
          <Numero
            icono={<Check size={12} />}
            label="Ya facturado"
            valor={ya_facturado}
            color="text-success-600"
          />
          <Numero
            icono={<Clock size={12} />}
            label="Por cobrar"
            valor={por_cobrar}
            color="text-warning-600"
          />
          <Numero
            icono={<TrendingUp size={12} />}
            label="Proyectado"
            valor={proyectado}
            color="text-primary-700"
            destacado
          />
        </div>
      </div>
    </div>
  );
}

function Numero({
  icono, label, valor, color, destacado,
}: {
  icono: React.ReactNode;
  label: string;
  valor: number;
  color: string;
  destacado?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${destacado ? "border-primary-200 bg-primary-50/40" : "border-surface-100 bg-surface-50/40"}`}>
      <div className="flex items-center gap-1 mb-1">
        <span className={`${color}`}>{icono}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-surface-500">
          {label}
        </span>
      </div>
      <p className={`text-base font-extrabold ${color} truncate`}>
        {formatearMonto(valor)}
      </p>
    </div>
  );
}
