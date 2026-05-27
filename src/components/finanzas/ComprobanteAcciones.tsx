"use client";

import { useState, useTransition } from "react";
import { Download, MessageSquare, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface Props {
  pagoId: string;
  /** Texto que se manda en el mensaje de WhatsApp. La URL del comprobante
   *  se agrega después al final. */
  mensajeBase?: string;
  /** Teléfono (formato wa.me, ya normalizado). Si vacío, se abre el chat
   *  sin destinatario. */
  telefono?: string | null;
  /** Variante visual: chip pequeño en la tabla, o botones grandes en el modal. */
  size?: "sm" | "md";
}

/**
 * Botones de descarga + compartir del comprobante.
 *
 * "Descargar" hace fetch al endpoint /api/comprobante/[pagoId] que
 * devuelve un PNG, lo convierte a blob y dispara un download nativo
 * con un nombre amigable.
 *
 * "Compartir por WhatsApp" abre wa.me con el mensaje base + un link
 * directo al endpoint (con timestamp para invalidar cache). Como la
 * route requiere sesión, el link solo funciona desde la PC/teléfono
 * de la maestra. Eso es lo esperado por ahora; subir al Storage como
 * link público temporal queda para una iteración futura.
 */
export default function ComprobanteAcciones({
  pagoId, mensajeBase, telefono, size = "sm",
}: Props) {
  const [downloading, startDownload] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  function handleDescargar() {
    setError(null);
    startDownload(async () => {
      try {
        const res = await fetch(`/api/comprobante/${pagoId}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(await res.text() || "No se pudo generar el comprobante");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `comprobante-${pagoId.slice(0, 8)}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Comprobante descargado");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al descargar";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  function handleCompartir() {
    const url = `${window.location.origin}/api/comprobante/${pagoId}?t=${Date.now()}`;
    const texto = [mensajeBase ?? "Te comparto el comprobante de pago.", url]
      .filter(Boolean)
      .join("\n\n");
    const tel = (telefono ?? "").replace(/\D/g, "");
    const wa = tel
      ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(wa, "_blank", "noopener,noreferrer");
  }

  const baseClass = size === "sm"
    ? "flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-colors"
    : "flex items-center gap-1.5 rounded-xl px-3 py-2 min-h-9 text-xs font-bold transition-colors";

  return (
    <div className="flex items-center gap-1.5" title={error ?? undefined}>
      <button
        type="button"
        onClick={handleDescargar}
        disabled={downloading}
        className={`${baseClass} bg-surface-100 text-surface-700 hover:bg-primary-100 hover:text-primary-700 disabled:opacity-50`}
        aria-label="Descargar comprobante"
      >
        {downloading
          ? <Loader2 size={size === "sm" ? 12 : 14} className="animate-spin" />
          : <Download size={size === "sm" ? 12 : 14} />}
        {size === "md" && "Comprobante"}
      </button>
      <button
        type="button"
        onClick={handleCompartir}
        className={`${baseClass} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
        aria-label="Compartir comprobante por WhatsApp"
        title="Compartir por WhatsApp"
      >
        <MessageSquare size={size === "sm" ? 12 : 14} />
        {size === "md" && "Compartir"}
      </button>
    </div>
  );
}
