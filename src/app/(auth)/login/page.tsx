import Image from "next/image";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="trazos-card trazos-tape animate-fade-in-up p-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl overflow-hidden shadow-md border-2 border-primary-200/50 animate-wiggle" style={{ animationDuration: "4s" }}>
          <Image src="/logo.png" alt="Trazos Logo" width={64} height={64} className="object-cover" />
        </div>
        <h1 className="trazos-gradient-text text-2xl font-extrabold tracking-tight">
          Trazos
        </h1>
        <p className="mt-2 text-sm text-surface-500 font-medium">
          El cuaderno digital del profe ✏️
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-danger-50 p-3 text-xs font-semibold text-danger-500 border border-danger-200">
          ⚠️ {error}
        </div>
      )}

      <form action={login} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-bold text-surface-800"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="maria@ejemplo.com"
            className="w-full rounded-xl border-2 border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-bold text-surface-800"
          >
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            placeholder="••••••••"
            className="w-full rounded-xl border-2 border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5 active:scale-[0.98]"
        >
          Iniciar sesión →
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-surface-500">
        ¿No tenés cuenta?{" "}
        <a href="/registro" className="font-bold text-primary-600 hover:text-primary-500 underline decoration-primary-300 underline-offset-2 decoration-2">
          Registrate
        </a>
      </p>
    </div>
  );
}

