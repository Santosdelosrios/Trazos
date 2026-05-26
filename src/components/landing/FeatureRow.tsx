interface FeatureRowProps {
  eyebrow: string;
  title: React.ReactNode;
  description: React.ReactNode;
  bullets?: string[];
  mockup: React.ReactNode;
  /** Si es true, el mockup va a la izquierda en desktop (alterna el layout). */
  reverse?: boolean;
}

export default function FeatureRow({
  eyebrow,
  title,
  description,
  bullets,
  mockup,
  reverse = false,
}: FeatureRowProps) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      {/* Texto */}
      <div className={reverse ? "lg:order-2" : "lg:order-1"}>
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary-600">
          {eyebrow}
        </p>
        <h3 className="font-serif text-2xl font-semibold leading-tight tracking-tight text-surface-900 sm:text-3xl">
          {title}
        </h3>
        <p className="mt-4 text-lg leading-relaxed text-surface-700">{description}</p>
        {bullets && (
          <ul className="mt-5 space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-surface-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Mockup */}
      <div className={reverse ? "lg:order-1" : "lg:order-2"}>{mockup}</div>
    </div>
  );
}
