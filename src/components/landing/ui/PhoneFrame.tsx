interface PhoneFrameProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Marco de celular para mockups mobile. El 70%+ del tráfico es mobile,
 * así que varios mockups se muestran dentro de este shell.
 */
export default function PhoneFrame({ children, className = "" }: PhoneFrameProps) {
  return (
    <div
      className={`relative mx-auto w-full max-w-[280px] rounded-[2.5rem] border-[6px] border-surface-900 bg-surface-900 shadow-[0_20px_50px_rgba(0,0,0,0.18)] ${className}`}
    >
      {/* Notch */}
      <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-surface-900" />
      {/* Pantalla */}
      <div className="overflow-hidden rounded-[2rem] bg-surface-50">{children}</div>
    </div>
  );
}
