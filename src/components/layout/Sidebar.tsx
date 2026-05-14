"use client";

import Image from "next/image";
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
  Pencil,
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
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-surface-200 bg-surface-0 transition-transform duration-300 ease-in-out md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Brand gradient accent strip at the very top */}
      <div className="h-1 w-full bg-gradient-to-r from-primary-500 via-primary-400 to-accent-400" />

      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-surface-200 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl overflow-hidden shadow-md border-2 border-primary-200/50 shrink-0">
          <Image src="/logo.png" alt="Trazos Logo" width={40} height={40} className="object-cover" />
        </div>
        <div className="flex-1">
          <h1 className="trazos-gradient-text text-base font-extrabold tracking-tight">
            Trazos
          </h1>
          <p className="flex items-center gap-1 text-[10px] font-semibold text-surface-400 tracking-wide">
            <Pencil size={10} className="text-primary-400" /> Cuaderno digital
          </p>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="md:hidden p-1 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
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
        <Link
          href="/perfil"
          onClick={() => setIsOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all",
            pathname === "/perfil"
              ? "bg-primary-50 border-primary-200/50 shadow-sm"
              : "bg-gradient-to-r from-primary-50 to-accent-50 border-primary-100/50 hover:shadow-sm"
          )}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 shadow-sm">
            <User size={14} strokeWidth={2.5} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-bold text-surface-900">
              Mi Perfil
            </p>
            <p className="truncate text-[10px] text-surface-500">Ver mis datos</p>
          </div>
        </Link>
        <div className="mt-3 text-center opacity-40 hover:opacity-70 transition-opacity">
          <p className="text-[9px] text-surface-400 font-semibold tracking-widest uppercase">Santos de los Rios</p>
        </div>
      </div>
    </aside>
  );
}

