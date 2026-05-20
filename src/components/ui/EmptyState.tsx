import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Icono principal (componente de lucide-react) */
  icon: LucideIcon;
  /** Título breve, accionable. Ej: "Todavía no hay alumnos" */
  title: string;
  /** Descripción opcional que explique el contexto */
  description?: string;
  /** CTA primaria opcional. Si tiene `href`, renderiza un Link; si tiene `onClick`, un button */
  cta?:
    | { label: string; href: string; onClick?: never }
    | { label: string; onClick: () => void; href?: never };
  /** Tamaño visual: compact (cards en grid) o full (página entera) */
  size?: "compact" | "full";
  className?: string;
}

/**
 * Estado vacío amigable y accionable. Pensado para reemplazar los
 * `<div>No hay X</div>` ad-hoc dispersos en la app.
 *
 * Diseño: icono circular sobre fondo suave, título bold, descripción
 * en surface-500, CTA en gradient primary cuando aplica.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  size = "full",
  className,
}: EmptyStateProps) {
  const isFull = size === "full";

  const ctaButton = cta && (
    cta.href ? (
      <Link
        href={cta.href}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-lg active:scale-[0.98]"
      >
        {cta.label}
      </Link>
    ) : (
      <button
        type="button"
        onClick={cta.onClick}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-lg active:scale-[0.98]"
      >
        {cta.label}
      </button>
    )
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center animate-fade-in-up",
        isFull ? "py-12 px-6" : "py-8 px-4",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-primary-50 text-primary-600 mb-4",
          isFull ? "h-16 w-16" : "h-12 w-12"
        )}
      >
        <Icon size={isFull ? 28 : 22} strokeWidth={1.8} />
      </div>

      <h3 className={cn(
        "font-bold text-surface-900",
        isFull ? "text-lg" : "text-base"
      )}>
        {title}
      </h3>

      {description && (
        <p className={cn(
          "mt-2 max-w-md text-surface-500 leading-relaxed",
          isFull ? "text-sm" : "text-xs"
        )}>
          {description}
        </p>
      )}

      {ctaButton}
    </div>
  );
}
