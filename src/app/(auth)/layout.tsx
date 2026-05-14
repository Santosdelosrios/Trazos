export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface-50 p-4">
      {/* Decorative dot grid background */}
      <div className="trazos-dots absolute inset-0 opacity-40" />

      {/* Decorative floating shapes */}
      <div className="absolute top-20 left-10 h-16 w-16 rounded-full bg-primary-200/30 animate-float" />
      <div className="absolute top-40 right-20 h-12 w-12 rounded-2xl bg-accent-200/40 animate-float" style={{ animationDelay: "1s" }} />
      <div className="absolute bottom-32 left-1/4 h-10 w-10 rounded-full bg-primary-300/20 animate-float" style={{ animationDelay: "2s" }} />
      <div className="absolute bottom-20 right-10 h-14 w-14 rounded-xl bg-accent-300/30 animate-float" style={{ animationDelay: "0.5s" }} />

      {/* Notebook ruled lines in background */}
      <div className="trazos-notebook absolute inset-0 opacity-20" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">{children}</div>

      {/* Footer watermark */}
      <div className="relative z-10 mt-8 text-center opacity-50 hover:opacity-80 transition-opacity">
        <p className="text-[11px] text-surface-500 font-semibold tracking-wide">Creada por Santos de los Rios</p>
      </div>
    </div>
  );
}
