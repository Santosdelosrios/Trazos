import { Bus, Package, Laptop, Landmark, Paperclip, type LucideIcon } from "lucide-react";
import type { CategoriaGasto } from "@/lib/types/database";

const ICONS: Record<CategoriaGasto, LucideIcon> = {
  viatico: Bus,
  material: Package,
  plataforma: Laptop,
  impuesto: Landmark,
  otro: Paperclip,
};

interface CategoriaGastoIconProps {
  categoria: CategoriaGasto;
  size?: number;
  className?: string;
}

export function CategoriaGastoIcon({ categoria, size = 16, className = "" }: CategoriaGastoIconProps) {
  const Icon = ICONS[categoria] || Paperclip;
  return <Icon size={size} className={className} />;
}
