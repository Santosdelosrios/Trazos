import { Calculator, Book, Beaker, Globe, Pencil, BookMarked, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  matematica: Calculator,
  lengua: Book,
  cs_naturales: Beaker,
  cs_sociales: Globe,
  otro: Pencil,
};

interface MateriaIconProps {
  materia: string;
  size?: number;
  className?: string;
}

export function MateriaIcon({ materia, size = 16, className = "" }: MateriaIconProps) {
  const Icon = ICONS[materia] || BookMarked;
  return <Icon size={size} className={className} />;
}
