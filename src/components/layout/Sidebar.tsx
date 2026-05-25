"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Calendar, 
  Users, 
  Sparkles, 
  Clock, 
  Trophy, 
  Wallet,
  User,
  Crown,
  X
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/alumnos", label: "Alumnos", icon: Users },
  { href: "/clases/nueva", label: "Finalizar Clase", icon: Sparkles },
  { href: "/clases", label: "Historial", icon: Clock },
  { href: "/hitos", label: "Hitos", icon: Trophy },
  { href: "/finanzas", label: "Finanzas", icon: Wallet },
];

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  plan?: "free" | "premium";
}

export default function Sidebar({ isOpen, setIsOpen, plan = "free" }: SidebarProps) {
  const pathname = usePathname();
  const isPremium = plan === "premium";

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-surface-200 bg-surface-0 transition-transform duration-500 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Brand gradient accent strip at the very top */}
      <div className="h-1 w-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent-400" />

      {/* Mobile Close Button */}
      <div className="flex items-center justify-end p-4 md:hidden">
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-lg transition-colors"
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>
      </div>

      <div className="h-4 md:block hidden" />

      {/* Mi Perfil - Distinct for Premium */}
      <div className="px-4 py-2">
        <Link
          href="/perfil"
          onClick={() => {
            if (window.innerWidth < 768) setIsOpen(false);
          }}
          className={cn(
            "flex flex-col gap-3 rounded-2xl p-4 border-2 transition-all group relative overflow-hidden",
            pathname === "/perfil"
              ? isPremium 
                ? "bg-amber-50 border-amber-300 shadow-sm" 
                : "bg-primary-50 border-primary-200 shadow-sm"
              : isPremium
                ? "bg-gradient-to-br from-amber-50/50 to-orange-50/50 border-amber-100 hover:border-amber-300 hover:shadow-md"
                : "bg-white border-surface-100 hover:border-primary-200 hover:shadow-md"
          )}
        >
          {isPremium && (
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-amber-200/20 to-transparent rounded-bl-full pointer-events-none" />
          )}

          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full shadow-md transition-transform group-hover:scale-110",
              isPremium 
                ? "bg-gradient-to-br from-amber-400 to-orange-500" 
                : "bg-gradient-to-br from-primary-400 to-primary-600"
            )}>
              {isPremium ? (
                <Crown size={18} strokeWidth={2.5} className="text-white" />
              ) : (
                <User size={18} strokeWidth={2.5} className="text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className={cn(
                  "truncate text-sm font-black",
                  isPremium ? "text-amber-900" : "text-surface-900"
                )}>
                  Mi Perfil
                </p>
                {isPremium && (
                  <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                )}
              </div>
              <p className={cn(
                "truncate text-[10px] font-bold uppercase tracking-wider",
                isPremium ? "text-amber-600" : "text-surface-500"
              )}>
                {isPremium ? "Plan Premium" : "Plan Gratuito"}
              </p>
            </div>
          </div>
        </Link>
      </div>

      <div className={cn(
        "mx-6 my-2 border-t",
        isPremium ? "border-amber-100" : "border-surface-100"
      )} />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/clases"
              ? pathname === "/clases" || (pathname.startsWith("/clases/") && !pathname.startsWith("/clases/nueva"))
              : pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (window.innerWidth < 768) setIsOpen(false);
              }}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                isActive
                  ? "bg-primary-50 text-primary-700 shadow-sm border border-primary-200/50"
                  : "text-surface-700 hover:bg-surface-100 hover:text-surface-900"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110",
                  isActive
                    ? "bg-primary-100 text-primary-600"
                    : "bg-surface-100 text-surface-500 group-hover:bg-surface-200 group-hover:text-surface-700"
                )}
              >
                <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-surface-200 p-4">
        <div className="text-center opacity-40 hover:opacity-70 transition-opacity">
          <p className="text-[9px] text-surface-400 font-semibold tracking-widest uppercase">Santos de los Rios</p>
        </div>
      </div>
    </aside>
  );
}

