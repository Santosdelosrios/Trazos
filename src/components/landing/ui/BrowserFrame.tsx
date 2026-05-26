interface BrowserFrameProps {
  children: React.ReactNode;
  url?: string;
  className?: string;
}

/**
 * Marco de navegador para envolver mockups de producto (desktop).
 * Cuando haya screenshots reales, se mete un <Image> adentro como children.
 */
export default function BrowserFrame({
  children,
  url = "trazosdemaestra.com.ar",
  className = "",
}: BrowserFrameProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)] ${className}`}
    >
      {/* Barra superior */}
      <div className="flex items-center gap-2 border-b border-surface-100 bg-surface-50 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-danger-300" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-warning-300" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-success-300" aria-hidden="true" />
        <div className="ml-3 hidden flex-1 sm:block">
          <div className="mx-auto w-fit rounded-md bg-white px-3 py-1 text-[11px] font-medium text-surface-400 border border-surface-100">
            {url}
          </div>
        </div>
      </div>
      {/* Contenido */}
      <div className="bg-surface-50">{children}</div>
    </div>
  );
}
