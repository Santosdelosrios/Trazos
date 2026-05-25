import { Sun, Moon, PartyPopper } from "lucide-react";
import type { BriefingDia } from "@/lib/briefing";
import BriefingCobranza from "./BriefingCobranza";

export default function BriefingCard({ briefing, esPremium }: { briefing: BriefingDia; esPremium: boolean }) {
  const Icon = briefing.momento === "noche" ? Moon : Sun;
  const plural = briefing.clasesHoy === 1 ? "" : "s";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary-700/30 bg-gradient-to-br from-primary-600 to-primary-700 p-6 text-white shadow-xl">
      {/* Decoración */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-12 right-12 h-24 w-24 rounded-full bg-white/5" />

      <div className="relative">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/70">
          <Icon size={16} />
          <span className="capitalize">{briefing.fechaLarga}</span>
        </div>

        <h1 className="trazos-heading mt-1.5 text-2xl font-extrabold tracking-tight">
          {briefing.saludo}, {briefing.nombre}
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-white/90">
          {briefing.clasesHoy > 0 ? (
            <>
              Hoy tenés <b>{briefing.clasesHoy} clase{plural}</b>
              {briefing.proximaClase ? (
                <>
                  {" "}
                  · la próxima a las <b>{briefing.proximaClase.hora}</b> con{" "}
                  {briefing.proximaClase.alumno}.
                </>
              ) : (
                " · ya pasaron todas, ¡buen trabajo!"
              )}
            </>
          ) : (
            <>Hoy no tenés clases programadas. ¡Día para recargar energías! ☕</>
          )}
        </p>

        {briefing.feriadoHoy && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <PartyPopper size={14} />
            Hoy es feriado: {briefing.feriadoHoy}
          </div>
        )}

        {/* Cobranzas */}
        <div className="mt-5">
          <BriefingCobranza
            count={briefing.deudores.count}
            total={briefing.deudores.total}
            nombres={briefing.deudores.nombres}
            esPremium={esPremium}
          />
        </div>
      </div>
    </div>
  );
}
