import { 
  TrendingUp, 
  Hourglass, 
  Star, 
  Sparkles 
} from "lucide-react";

interface MetricasNegocio {
  horas_mes: number;
  alumno_estrella: string;
  materia_top: string;
}

export default function SaludNegocio({ metricas }: { metricas: MetricasNegocio | null }) {
  // Proveer valores por defecto en caso de que la data sea null (ej. si falta la migración SQL)
  const data = metricas || {
    horas_mes: 0,
    alumno_estrella: "—",
  };

  return (
    <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50/50 to-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary-900">
          Salud del Negocio <TrendingUp size={16} />
        </h2>
        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
          Este Mes
        </span>
      </div>

      <div className="space-y-5">
        {/* Horas Trabajadas */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm text-primary-600">
            <Hourglass size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-surface-500">Horas trabajadas</p>
            <p className="text-lg font-black text-surface-900 leading-tight">
              {data.horas_mes} <span className="text-sm font-normal text-surface-600">hs</span>
            </p>
          </div>
        </div>

        {/* Alumno Estrella */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm text-warning-500">
            <Star size={20} fill="currentColor" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-surface-500">Alumno más rentable</p>
            <p className="text-lg font-black text-surface-900 truncate max-w-[150px] leading-tight">
              {data.alumno_estrella}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-white/50 p-3 text-center border border-primary-100">
        <p className="flex items-center justify-center gap-2 text-[10px] italic text-primary-800">
          "Seguí así, ¡estás transformando vidas!" <Sparkles size={12} />
        </p>
      </div>
    </div>
  );
}
