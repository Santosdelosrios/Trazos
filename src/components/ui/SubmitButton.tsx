"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import React from "react";

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  loadingText?: string;
  icon?: React.ReactNode;
}

export default function SubmitButton({ 
  children, 
  loadingText = "Guardando...", 
  icon,
  className,
  disabled,
  ...props 
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-primary-700 active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${className || ""}`}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          {loadingText}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
