"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

export interface ToastInput {
  message: string;
  type?: ToastType;
  /** Duración en ms. Default: 4000 (5000 para errores). 0 = persistente. */
  duration?: number;
  /** Acción opcional al final del toast (ej. "Deshacer") */
  action?: { label: string; onClick: () => void };
}

interface Toast extends Required<Pick<ToastInput, "message" | "type" | "duration">> {
  id: string;
  action?: ToastInput["action"];
}

interface ToastContextValue {
  show: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  success: (message: string, opts?: Omit<ToastInput, "message" | "type">) => string;
  error: (message: string, opts?: Omit<ToastInput, "message" | "type">) => string;
  info: (message: string, opts?: Omit<ToastInput, "message" | "type">) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Hook para disparar toasts desde cualquier client component.
 * Uso: `const toast = useToast(); toast.success("Pago registrado")`
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast() debe usarse dentro de <ToastProvider>");
  }
  return ctx;
}

/**
 * Provider de toasts. Va una sola vez cerca de la raíz del árbol
 * (típicamente en el layout del dashboard).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Mapa de id → timeout para poder cancelarlo al hacer dismiss manual
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (input: ToastInput): string => {
      const id = crypto.randomUUID();
      const type = input.type ?? "info";
      const duration = input.duration ?? (type === "error" ? 5000 : 4000);

      setToasts((prev) => [
        ...prev,
        { id, message: input.message, type, duration, action: input.action },
      ]);

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }

      return id;
    },
    [dismiss]
  );

  // Cleanup de timers al unmount
  useEffect(() => {
    const timersRef = timers.current;
    return () => {
      timersRef.forEach((t) => clearTimeout(t));
      timersRef.clear();
    };
  }, []);

  const api = useMemo<ToastContextValue>(
    () => ({
      show,
      dismiss,
      success: (message, opts) => show({ ...opts, message, type: "success" }),
      error: (message, opts) => show({ ...opts, message, type: "error" }),
      info: (message, opts) => show({ ...opts, message, type: "info" }),
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ============================================================
// Viewport (presentación)
// ============================================================

const TYPE_CONFIG: Record<ToastType, { bg: string; border: string; icon: typeof CheckCircle2; iconColor: string }> = {
  success: {
    bg: "bg-white",
    border: "border-success-200",
    icon: CheckCircle2,
    iconColor: "text-success-500",
  },
  error: {
    bg: "bg-white",
    border: "border-danger-200",
    icon: AlertCircle,
    iconColor: "text-danger-500",
  },
  info: {
    bg: "bg-white",
    border: "border-primary-200",
    icon: Info,
    iconColor: "text-primary-500",
  },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-24 left-1/2 z-[100] flex w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 md:bottom-6 md:left-auto md:right-6 md:translate-x-0"
    >
      {toasts.map((toast) => {
        const config = TYPE_CONFIG[toast.type];
        const Icon = config.icon;
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3 shadow-lg animate-fade-in-up",
              config.bg,
              config.border
            )}
          >
            <Icon size={18} className={cn("shrink-0 mt-0.5", config.iconColor)} />
            <p className="flex-1 text-sm font-medium leading-snug text-surface-800">
              {toast.message}
            </p>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action!.onClick();
                  onDismiss(toast.id);
                }}
                className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold text-primary-600 hover:bg-primary-50 transition-colors"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 rounded-lg p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
              aria-label="Cerrar notificación"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
