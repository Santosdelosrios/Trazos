import type { ReactNode } from "react";

export const FIELD_INPUT_CLASS =
  "w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm font-semibold text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100";

export const FIELD_INPUT_CLASS_PLAIN =
  "w-full rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100";

interface FormFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function FormField({ label, hint, children, className }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-surface-400">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-surface-400">{hint}</p>}
    </div>
  );
}
