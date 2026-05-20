import { GraduationCap, BookOpen, CalendarDays } from "lucide-react";

interface Props {
  totalAlumnos: number;
  totalClases: number;
  clasesMes: number;
}

const STATS = [
  { key: "alumnos" as const, label: "Alumnos", icon: GraduationCap, color: "bg-primary-50 text-primary-600" },
  { key: "totalClases" as const, label: "Clases Totales", icon: BookOpen, color: "bg-accent-50 text-accent-600" },
  { key: "clasesMes" as const, label: "Clases este Mes", icon: CalendarDays, color: "bg-success-50 text-success-600" },
];

/**
 * Grid de 3 stats del perfil de la maestra (alumnos, total clases, clases del mes).
 * Sin estado — server-friendly.
 */
export default function PerfilStats({ totalAlumnos, totalClases, clasesMes }: Props) {
  const values: Record<string, number> = {
    alumnos: totalAlumnos,
    totalClases,
    clasesMes,
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {STATS.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl bg-white border border-surface-200 p-5 shadow-sm text-center"
        >
          <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}>
            <stat.icon size={20} />
          </div>
          <p className="text-2xl font-bold text-surface-900">{values[stat.key]}</p>
          <p className="text-xs font-medium text-surface-500 mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
