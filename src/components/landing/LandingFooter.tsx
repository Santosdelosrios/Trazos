import Link from "next/link";
import { PenTool, Instagram } from "lucide-react";
import { CONTACTO_EMAIL, INSTAGRAM_URL } from "@/lib/landing/config";

export default function LandingFooter() {
  const año = new Date().getFullYear();

  return (
    <footer className="border-t border-surface-200 px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 rotate-[-3deg] items-center justify-center rounded-lg bg-primary-600 text-white">
            <PenTool className="h-4 w-4" />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-surface-800">
            Trazos
          </span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-surface-600">
          <Link href="/privacidad" className="transition-colors hover:text-primary-600">
            Privacidad
          </Link>
          {/* TODO: crear /terminos. Por ahora apunta a privacidad. */}
          <Link href="/privacidad" className="transition-colors hover:text-primary-600">
            Términos
          </Link>
          <a
            href={`mailto:${CONTACTO_EMAIL}`}
            className="transition-colors hover:text-primary-600"
          >
            Contacto
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-primary-600"
          >
            <Instagram className="h-4 w-4" />
            Instagram
          </a>
        </nav>
      </div>

      <p className="mt-8 text-center text-sm text-surface-400">
        Hecho con ☕ y paciencia en Argentina · © {año} Trazos
      </p>
    </footer>
  );
}
