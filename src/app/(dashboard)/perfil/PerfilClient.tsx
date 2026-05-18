"use client";

import { useState } from "react";
import { updateProfile, deleteAccount } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  CalendarDays,
  GraduationCap,
  BookOpen,
  LogOut,
  Pencil,
  Check,
  X,
  ShieldCheck,
  Crown,
  Sparkles,
  Users,
  CalendarSync,
  FileText,
  Palette,
  CircleCheck,
} from "lucide-react";

interface ProfileData {
  email: string;
  nombre: string;
  createdAt: string;
  plan: "free" | "premium";
  calendarToken: string | null;
  totalAlumnos: number;
  totalClases: number;
  clasesMes: number;
}

export default function PerfilClient({
  profile,
  error,
  success,
}: {
  profile: ProfileData;
  error?: string;
  success?: string;
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      // Usamos window.location para asegurar un refresh total y limpieza de estado
      window.location.href = "/login";
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
      setIsLoggingOut(false);
    }
  };

  const memberSince = new Date(profile.createdAt).toLocaleDateString("es-AR", {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-fade-in-up pb-12">
      {/* Header */}
      <div>
        <h1 className="trazos-heading text-2xl font-extrabold tracking-tight text-surface-900">
          Mi Perfil
        </h1>
        <p className="mt-3 text-sm text-surface-500 font-medium">
          Tu información personal y resumen de actividad.
        </p>
      </div>

      {/* Feedback messages */}
      {error && (
        <div className="rounded-xl bg-danger-50 p-4 text-sm font-semibold text-danger-600 border border-danger-200 animate-fade-in-up">
          ⚠️ {error}
        </div>
      )}
      {success === "true" && (
        <div className="rounded-xl bg-success-50 p-4 text-sm font-semibold text-success-600 border border-success-200 animate-fade-in-up flex items-center gap-2">
          <Check size={16} /> ¡Perfil actualizado correctamente!
        </div>
      )}
      {success === "premium" && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-600 border border-amber-200 animate-fade-in-up flex items-center gap-2">
          <Sparkles size={16} /> ¡Bienvenida a Trazos Premium! Tu pago se está procesando y se activará en breve.
        </div>
      )}

      {/* Profile Card */}
      <div className="rounded-2xl bg-white shadow-sm border border-surface-200 overflow-hidden">
        {/* Gradient Header */}
        <div className="h-24 trazos-gradient relative">
          <div className="absolute inset-0 trazos-dots opacity-20 mix-blend-overlay"></div>
        </div>

        {/* Avatar + Name */}
        <div className="px-6 pb-6 -mt-10 relative">
          <div className="flex items-end gap-4 mb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-3xl font-black text-primary-600 shadow-lg border-4 border-white">
              {profile.nombre
                ? profile.nombre.charAt(0).toUpperCase()
                : "M"}
            </div>
            <div className="flex-1 pb-1">
              {isEditingName ? (
                <form
                  action={updateProfile}
                  className="flex items-center gap-2"
                >
                  <input
                    name="nombre"
                    defaultValue={profile.nombre}
                    autoFocus
                    required
                    className="rounded-lg border-2 border-primary-200 bg-white px-3 py-1.5 text-lg font-bold text-surface-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 w-full"
                  />
                  <button
                    type="submit"
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors flex-shrink-0"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(false)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-100 text-surface-500 hover:bg-surface-200 transition-colors flex-shrink-0"
                  >
                    <X size={16} />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-surface-900">
                    {profile.nombre || "Sin nombre"}
                  </h2>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="p-1.5 rounded-lg text-surface-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    title="Editar nombre"
                  >
                    <Pencil size={14} />
                  </button>
                  {profile.plan === "premium" ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-gradient-to-r from-amber-400 to-amber-500 text-white px-2.5 py-1 rounded-lg shadow-sm">
                      <Crown size={10} /> PREMIUM
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-surface-100 text-surface-500 px-2.5 py-1 rounded-lg">
                      GRATIS
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Info rows */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 py-3 border-b border-surface-100">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-100 text-surface-500">
                <Mail size={18} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
                  Email
                </p>
                <p className="text-sm font-medium text-surface-900">
                  {profile.email}
                </p>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-success-600 bg-success-50 px-2 py-1 rounded-lg border border-success-200">
                <ShieldCheck size={12} />
                Verificado
              </div>
            </div>

            <div className="flex items-center gap-3 py-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-100 text-surface-500">
                <CalendarDays size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-surface-400">
                  Miembro desde
                </p>
                <p className="text-sm font-medium text-surface-900">
                  {memberSince}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Alumnos",
            value: profile.totalAlumnos,
            icon: GraduationCap,
            color: "bg-primary-50 text-primary-600",
          },
          {
            label: "Clases Totales",
            value: profile.totalClases,
            icon: BookOpen,
            color: "bg-accent-50 text-accent-600",
          },
          {
            label: "Clases este Mes",
            value: profile.clasesMes,
            icon: CalendarDays,
            color: "bg-success-50 text-success-600",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl bg-white border border-surface-200 p-5 shadow-sm text-center"
          >
            <div
              className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}
            >
              <stat.icon size={20} />
            </div>
            <p className="text-2xl font-bold text-surface-900">{stat.value}</p>
            <p className="text-xs font-medium text-surface-500 mt-1">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Mi Plan */}
      <div className="rounded-2xl bg-white border border-surface-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-100 bg-surface-50/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-surface-900 flex items-center gap-2">
            <Crown size={16} className={profile.plan === "premium" ? "text-amber-500" : "text-surface-400"} />
            Mi Plan
          </h3>
          {profile.plan === "premium" ? (
            <span className="flex items-center gap-1 text-[10px] font-bold bg-gradient-to-r from-amber-400 to-amber-500 text-white px-2.5 py-1 rounded-lg shadow-sm">
              <Sparkles size={10} /> ACTIVO
            </span>
          ) : (
            <span className="text-[10px] font-bold bg-surface-100 text-surface-500 px-2.5 py-1 rounded-lg">
              PLAN GRATUITO
            </span>
          )}
        </div>

        {profile.plan === "premium" ? (
          /* ─── Premium Active ─── */
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg">
                <Crown size={28} />
              </div>
              <div>
                <h4 className="text-lg font-bold text-surface-900">Trazos Premium</h4>
                <p className="text-sm text-surface-500">Todas las funciones desbloqueadas.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Users, label: "Alumnos ilimitados" },
                { icon: CalendarSync, label: "Sincronización con Calendar" },
                { icon: FileText, label: "Reportes PDF con IA" },
                { icon: Sparkles, label: "Asistente Tiza" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 rounded-xl bg-success-50 border border-success-100 px-3 py-2.5">
                  <CircleCheck size={14} className="text-success-600 flex-shrink-0" />
                  <span className="text-xs font-medium text-success-800">{f.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-surface-400 text-center pt-1">
              Gracias por apoyar Trazos 💛
            </p>
            <div className="pt-4 flex justify-center">
              <button
                disabled={isCancelling}
                onClick={async () => {
                  if (confirm("¿Estás segura de que querés cancelar tu suscripción Premium? Vas a perder el acceso a las funciones extra al final del período.")) {
                    setIsCancelling(true);
                    try {
                      const res = await fetch("/api/suscripcion/cancelar", { method: "POST" });
                      if (!res.ok) throw new Error("Error al cancelar");
                      router.refresh();
                    } catch (err) {
                      alert("No se pudo cancelar la suscripción. Por favor intentá más tarde.");
                      setIsCancelling(false);
                    }
                  }
                }}
                className="text-[10px] font-bold text-surface-400 hover:text-danger-600 transition-colors uppercase tracking-widest"
              >
                {isCancelling ? "Cancelando..." : "Cancelar suscripción"}
              </button>
            </div>
          </div>
        ) : (
          /* ─── Free → Upgrade CTA ─── */
          <div className="p-6 space-y-6">
            {/* Current plan limits */}
            <div className="rounded-xl bg-surface-50 border border-surface-100 p-4 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-surface-400">Tu plan actual</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-700">Alumnos</span>
                <span className="text-sm font-bold text-surface-900">{profile.totalAlumnos} / 10</span>
              </div>
              <div className="w-full bg-surface-200 rounded-full h-1.5">
                <div
                  className="bg-primary-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min((profile.totalAlumnos / 10) * 100, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-700">Sync Google Calendar</span>
                <X size={14} className="text-surface-400" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-700">Asistente Virtual Tiza</span>
                <X size={14} className="text-surface-400" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-700">Reportes PDF con IA</span>
                <X size={14} className="text-surface-400" />
              </div>
            </div>

            {/* Premium offer */}
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-200 p-5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-200/30 to-transparent rounded-bl-full" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-md">
                    <Crown size={22} />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900">Trazos Premium</h4>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-amber-800">$4.500</span>
                      <span className="text-xs font-medium text-amber-600">/mes</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {[
                    { icon: Users, text: "Alumnos ilimitados" },
                    { icon: CalendarSync, text: "Sincronizá tu agenda con Google Calendar" },
                    { icon: Sparkles, text: "Asistente Virtual Tiza" },
                    { icon: FileText, text: "Reportes mensuales PDF con IA para padres" },
                  ].map((f) => (
                    <div key={f.text} className="flex items-center gap-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-600">
                        <f.icon size={13} />
                      </div>
                      <span className="text-sm text-amber-800">{f.text}</span>
                    </div>
                  ))}
                </div>

                {subscriptionError && (
                  <p className="text-xs font-bold text-danger-600 bg-danger-50 px-3 py-2 rounded-lg mb-3">
                    {subscriptionError}
                  </p>
                )}

                <button
                  disabled={isSubscribing}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:from-amber-600 hover:to-amber-700 transition-all active:scale-[0.98] hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={async () => {
                    setIsSubscribing(true);
                    setSubscriptionError(null);
                    try {
                      const res = await fetch("/api/suscripcion", { method: "POST" });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Error desconocido");
                      if (data.init_point) {
                        window.location.href = data.init_point;
                      } else {
                        throw new Error("No se recibió la URL de pago.");
                      }
                    } catch (err: any) {
                      setSubscriptionError(err.message || "No se pudo crear la suscripción.");
                      setIsSubscribing(false);
                    }
                  }}
                >
                  {isSubscribing ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Redirigiendo a MercadoPago...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Suscribirme a Premium
                    </>
                  )}
                </button>
                <p className="text-[10px] text-amber-600 text-center mt-2">
                  Pago seguro vía MercadoPago · Cancelá cuando quieras
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sesión */}
      <div className="rounded-2xl bg-white border border-surface-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-100 bg-surface-50/50">
          <h3 className="text-sm font-bold text-surface-900">Sesión</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-surface-900">
                Cerrar sesión
              </p>
              <p className="text-xs text-surface-500 mt-0.5">
                Vas a volver a la pantalla de inicio de sesión.
              </p>
            </div>
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl bg-danger-50 border border-danger-200 px-4 py-2.5 text-sm font-bold text-danger-600 hover:bg-danger-100 hover:border-danger-300 transition-all active:scale-95 disabled:opacity-50"
            >
              <LogOut size={16} />
              {isLoggingOut ? "Cerrando..." : "Cerrar sesión"}
            </button>
          </div>
        </div>
      </div>

      {/* Zona Peligrosa */}
      <div className="rounded-2xl bg-white border border-danger-200 shadow-sm overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-danger-100 bg-danger-50/30">
          <h3 className="text-sm font-bold text-danger-900">Zona Peligrosa</h3>
        </div>
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-surface-900">
                Eliminar mi cuenta
              </p>
              <p className="text-xs text-surface-500 mt-1 max-w-md">
                Esta acción borrará permanentemente tu perfil, todos tus alumnos, clases, finanzas e hitos pedagógicos. <strong className="text-danger-600">No se puede deshacer.</strong>
              </p>
            </div>
            <button
              type="button"
              disabled={isDeletingAccount}
              onClick={async () => {
                const conf1 = confirm("¿Estás 100% seguro de que querés ELIMINAR tu cuenta?");
                if (!conf1) return;
                const conf2 = prompt("Escribí 'ELIMINAR' para confirmar la eliminación permanente de todos tus datos.");
                if (conf2 === "ELIMINAR") {
                  setIsDeletingAccount(true);
                  try {
                    await deleteAccount();
                  } catch (e) {
                    setIsDeletingAccount(false);
                  }
                }
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-danger-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-danger-700 active:scale-95 disabled:opacity-50"
            >
              <X size={16} />
              {isDeletingAccount ? "Eliminando..." : "Eliminar cuenta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
