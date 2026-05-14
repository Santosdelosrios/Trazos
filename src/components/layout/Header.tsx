import { Menu } from "lucide-react";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-surface-200 bg-white/80 px-6 backdrop-blur-md">
      <div className="flex items-center">
        <button
          onClick={onMenuClick}
          className="md:hidden mr-4 rounded-lg p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-200 transition-colors"
        >
          <Menu size={24} />
        </button>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-surface-700">
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
