import Link from "next/link";
import { PenTool } from "lucide-react";
import { REGISTRO_URL, LOGIN_URL } from "@/lib/landing/config";

export default function LandingNav() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-surface-200/70 glass">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="Trazos — inicio">
          <span className="flex h-9 w-9 rotate-[-3deg] items-center justify-center rounded-lg bg-primary-600 text-white shadow-sm">
            <PenTool className="h-4 w-4" />
          </span>
          <span className="text-xl font-extrabold tracking-tight text-surface-800">
            Trazos
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href={LOGIN_URL}
            className="hidden rounded-lg px-3 py-2 text-sm font-bold text-surface-700 transition-colors hover:text-surface-900 sm:inline-block"
          >
            Iniciar sesión
          </Link>
          <Link
            href={REGISTRO_URL}
            className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-md active:scale-95"
          >
            Empezar gratis
          </Link>
        </div>
      </nav>
    </header>
  );
}
