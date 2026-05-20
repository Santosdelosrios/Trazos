import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuClick?: () => void;
  isSidebarOpen?: boolean;
}

export default function Header({ onMenuClick, isSidebarOpen }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-surface-200 bg-white/80 px-4 md:px-6 backdrop-blur-md">
      <div className="flex flex-1 items-center">
        <button
          onClick={onMenuClick}
          className="hidden md:inline-flex rounded-lg p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-200 transition-all active:scale-90"
          title={isSidebarOpen ? "Cerrar menú" : "Abrir menú"}
        >
          <Menu size={24} className={cn("transition-transform duration-300", isSidebarOpen ? "rotate-90" : "rotate-0")} />
        </button>
      </div>

      <Link href="/dashboard" className="flex items-center gap-2 transition-transform active:scale-95">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl overflow-hidden shadow-sm border border-primary-100 shrink-0">
          <Image src="/logo.png" alt="Trazos Logo" width={32} height={32} className="object-cover" />
        </div>
        <h1 className="trazos-gradient-text text-xl font-black tracking-tighter hidden sm:block">
          Trazos
        </h1>
      </Link>

      <div className="flex flex-1 items-center justify-end gap-4">
        <span className="text-[10px] md:text-sm font-medium text-surface-500 capitalize">
          {new Date().toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </span>
      </div>
    </header>
  );
}
