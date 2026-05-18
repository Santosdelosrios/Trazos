"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Calendar, Users, Sparkles, Wallet } from "lucide-react";

const BOTTOM_NAV_ITEMS = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/clases/nueva", label: "Clase", icon: Sparkles, isCenter: true },
  { href: "/alumnos", label: "Alumnos", icon: Users },
  { href: "/finanzas", label: "Finanzas", icon: Wallet },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-surface-200 bg-surface-0/95 backdrop-blur-lg safe-bottom">
      <div className="flex items-end justify-around px-2 pt-1.5 pb-2">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/clases/nueva"
              ? pathname.startsWith("/clases/nueva")
              : item.href === "/finanzas"
              ? pathname.startsWith("/finanzas")
              : pathname === item.href;

          if (item.isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center -mt-5"
              >
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 active:scale-90",
                    isActive
                      ? "trazos-gradient shadow-primary-500/30"
                      : "bg-gradient-to-br from-primary-500 to-primary-600 shadow-primary-500/20 hover:shadow-primary-500/40"
                  )}
                >
                  <item.icon size={24} strokeWidth={2.5} className="text-white" />
                </div>
                <span className="mt-1 text-[10px] font-bold text-primary-600">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 transition-colors",
                isActive ? "text-primary-600" : "text-surface-400"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                className="transition-transform duration-200"
              />
              <span
                className={cn(
                  "text-[10px] leading-tight",
                  isActive ? "font-bold" : "font-medium"
                )}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="absolute -bottom-0.5 h-0.5 w-5 rounded-full bg-primary-500" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
