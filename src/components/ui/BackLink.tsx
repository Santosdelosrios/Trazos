import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  /** Ruta absoluta a la página padre. Ej: "/finanzas". */
  href: string;
  /** Texto del link. Ej: "Volver a Finanzas". */
  label: string;
  /** Clase extra opcional. */
  className?: string;
}

/**
 * Link "volver a la pantalla anterior". Usado consistentemente en
 * las páginas secundarias (las que no están en el sidebar) para que
 * la maestra siempre tenga una forma rápida de subir un nivel.
 *
 * Estilo unificado: chip chico arriba del título de la página, con
 * flecha y texto.
 */
export default function BackLink({ href, label, className = "" }: Props) {
  return (
    <Link
      href={href}
      className={`mb-3 flex w-fit items-center gap-1 text-xs font-bold text-primary-600 hover:underline ${className}`}
    >
      <ArrowLeft size={14} /> {label}
    </Link>
  );
}
