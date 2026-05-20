"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Sparkles, Loader2, CheckCircle2, AlertCircle, Phone } from "lucide-react";
import type { ChatMessage, GeminiHistoryEntry, ActionTaken } from "@/lib/asistente/types";

const QUICK_REPLIES = [
  "¿Qué tengo hoy?",
  "¿Cómo voy este mes?",
  "Organizame el cobro",
];

// --- WhatsApp Preview Parser ---
const WHATSAPP_REGEX = /---WHATSAPP_PREVIEW---\n([\s\S]*?)\n---END_PREVIEW---/g;

function parseWhatsAppPreviews(content: string): { segments: Array<{ type: "text" | "whatsapp"; content: string }> } {
  const segments: Array<{ type: "text" | "whatsapp"; content: string }> = [];
  let lastIndex = 0;

  // Reset regex state
  WHATSAPP_REGEX.lastIndex = 0;

  let match;
  while ((match = WHATSAPP_REGEX.exec(content)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) {
        segments.push({ type: "text", content: textBefore });
      }
    }
    // Add the WhatsApp preview
    segments.push({ type: "whatsapp", content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex).trim();
    if (remaining) {
      segments.push({ type: "text", content: remaining });
    }
  }

  // If no previews found, return the whole content as text
  if (segments.length === 0) {
    segments.push({ type: "text", content });
  }

  return { segments };
}

function WhatsAppPreviewCard({ message }: { message: string }) {
  const waLink = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <div className="mt-2 mb-1 rounded-xl overflow-hidden border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
      {/* Header */}
      <div className="bg-emerald-600 px-3 py-1.5 flex items-center gap-2">
        <Phone size={12} className="text-white" />
        <span className="text-[10px] font-bold text-white uppercase tracking-wider">Previsualización WhatsApp</span>
      </div>
      {/* Message body — styled like a WA chat bubble */}
      <div className="px-3 py-2.5">
        <div
          className="bg-white rounded-lg rounded-tl-none px-3 py-2 text-[13px] leading-relaxed text-surface-800 whitespace-pre-wrap"
          style={{
            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
          }}
        >
          {message}
        </div>
      </div>
      {/* Send button */}
      <div className="px-3 pb-3">
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="
            flex items-center justify-center gap-2
            w-full py-2.5 rounded-xl
            bg-emerald-500 hover:bg-emerald-600
            text-white text-sm font-bold
            transition-all duration-200
            hover:shadow-md hover:shadow-emerald-200
            active:scale-[0.98]
          "
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Enviar por WhatsApp
        </a>
      </div>
    </div>
  );
}

/**
 * Chat flotante del agente "Tiza".
 * Se renderiza como FAB + panel desplegable.
 * Solo visible para usuarios premium (el parent controla el renderizado).
 */
export default function TizaChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<GeminiHistoryEntry[]>([]);
  // Ref espejo de `history` para que `sendMessage` siempre vea el valor más
  // reciente sin reinstanciarse en cada actualización.
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus en el input cuando se abre
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    // Mensaje del asistente vacío que iremos rellenando en streaming
    const assistantId = crypto.randomUUID();
    const assistantSeed: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      actions: [],
    };

    setMessages((prev) => [...prev, userMsg, assistantSeed]);
    setInput("");
    setIsLoading(true);

    // Helper para actualizar el contenido del mensaje del asistente
    const appendToken = (token: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m))
      );
    };

    const appendAction = (action: ActionTaken) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, actions: [...(m.actions || []), action] }
            : m
        )
      );
    };

    const replaceContent = (content: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content } : m))
      );
    };

    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), history: historyRef.current }),
      });

      if (!res.ok || !res.body) {
        // Error HTTP — intentamos leer JSON de error si vino así
        let errorText = "Hubo un error, intentá de nuevo 😅";
        try {
          const data = await res.json();
          errorText = data.error || data.reply || errorText;
        } catch {
          // body no era JSON
        }
        replaceContent(errorText);
        return;
      }

      // Leer el stream SSE
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE separa eventos con doble \n
        const events = buffer.split("\n\n");
        buffer = events.pop() || ""; // último puede estar incompleto

        for (const event of events) {
          const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(6));
            if (payload.type === "token") {
              appendToken(payload.text);
            } else if (payload.type === "action") {
              appendAction(payload.action);
            } else if (payload.type === "done") {
              setHistory(payload.history || []);
            } else if (payload.type === "error") {
              // Si ya hubo contenido o acciones, agregamos el error como nota
              // al final. Si no hubo nada, reemplazamos el bubble vacío.
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m;
                  const hasContent = m.content.trim().length > 0;
                  const hasActions = (m.actions?.length ?? 0) > 0;
                  if (hasContent || hasActions) {
                    return { ...m, content: m.content + (m.content ? "\n\n" : "") + (payload.reply || "") };
                  }
                  return { ...m, content: payload.reply || "" };
                })
              );
              if (payload.history) setHistory(payload.history);
            }
          } catch {
            // ignorar JSON malformado en un chunk parcial
          }
        }
      }
    } catch {
      replaceContent("Uy, no pude conectarme. ¿Tenés internet? 📡");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // --- Render a single message bubble with WhatsApp preview support ---
  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.role !== "assistant") {
      return <p className="whitespace-pre-wrap">{msg.content}</p>;
    }

    // Parse for WhatsApp previews
    const { segments } = parseWhatsAppPreviews(msg.content);
    const hasWhatsApp = segments.some((s) => s.type === "whatsapp");

    if (!hasWhatsApp) {
      return <p className="whitespace-pre-wrap">{msg.content}</p>;
    }

    return (
      <div>
        {segments.map((seg, i) =>
          seg.type === "text" ? (
            <p key={i} className="whitespace-pre-wrap">{seg.content}</p>
          ) : (
            <WhatsAppPreviewCard key={i} message={seg.content} />
          )
        )}
      </div>
    );
  };

  return (
    <>
      {/* ===== FAB Button ===== */}
      <button
        id="tiza-fab"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50
          w-14 h-14 rounded-full
          flex items-center justify-center
          shadow-lg shadow-primary-500/20
          transition-all duration-300 ease-out
          ${isOpen
            ? "bg-surface-700 rotate-90 scale-95"
            : "trazos-gradient hover:shadow-xl hover:shadow-primary-500/30 hover:scale-110"
          }
        `}
        aria-label={isOpen ? "Cerrar Tiza" : "Abrir Tiza"}
      >
        {isOpen ? (
          <X size={22} className="text-white" />
        ) : (
          <MessageCircle size={22} className="text-white" />
        )}
      </button>

      {/* ===== Chat Panel ===== */}
      <div
        className={`
          fixed bottom-40 right-4 md:bottom-24 md:right-6 z-50
          w-[calc(100vw-2rem)] md:w-[calc(100vw-3rem)] max-w-sm

          rounded-2xl overflow-hidden
          flex flex-col
          transition-all duration-300 ease-out
          ${isOpen
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-y-4 scale-95 pointer-events-none"
          }
        `}
        style={{
          height: "min(70vh, 520px)",
          border: "1.5px solid var(--color-surface-200)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
          background: "var(--color-surface-0)",
        }}
      >
        {/* Header */}
        <div className="trazos-gradient px-4 py-3 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-sm leading-tight">Tiza</h3>
            <p className="text-white/70 text-xs">Tu asistente de Trazos ✨</p>
          </div>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
          style={{ background: "var(--color-surface-50)" }}
        >
          {/* Welcome message */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-3">
              <div className="w-12 h-12 rounded-full trazos-gradient flex items-center justify-center animate-float">
                <Sparkles size={20} className="text-white" />
              </div>
              <p className="text-surface-500 text-sm leading-relaxed">
                ¡Hola! Soy <strong className="text-primary-600">Tiza</strong>, tu asistente.
                Podés pedirme que agende clases, registre cobros o te arme el mensaje de cobro para WhatsApp.
              </p>
              {/* Quick replies */}
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {QUICK_REPLIES.map((text) => (
                  <button
                    key={text}
                    onClick={() => sendMessage(text)}
                    className="text-xs px-3 py-1.5 rounded-full border border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg) => {
            // Mensaje del asistente vacío durante streaming → mostrar typing indicator
            const isPendingAssistant =
              msg.role === "assistant" && msg.content === "" && (!msg.actions || msg.actions.length === 0);

            if (isPendingAssistant) {
              return (
                <div key={msg.id} className="flex justify-start animate-fade-in-up">
                  <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 border border-surface-100 flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-xs text-surface-400">Tiza está pensando…</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}
              >
                <div
                  className={`
                    max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                    ${msg.role === "user"
                      ? "bg-primary-500 text-white rounded-br-md"
                      : "bg-white text-surface-800 rounded-bl-md border border-surface-100"
                    }
                  `}
                  style={msg.role === "assistant" ? {
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  } : undefined}
                >
                  {/* Actions taken (only for assistant) — arriba para feedback inmediato durante streaming */}
                  {msg.role === "assistant" && msg.actions && msg.actions.length > 0 && (
                    <div className="mb-2 pb-2 border-b border-surface-100 space-y-1">
                      {msg.actions.map((action: ActionTaken, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          {action.success ? (
                            <CheckCircle2 size={12} className="text-success-500 shrink-0" />
                          ) : (
                            <AlertCircle size={12} className="text-danger-500 shrink-0" />
                          )}
                          <span className="text-surface-500">{action.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message text (with WhatsApp preview support) */}
                  {renderMessageContent(msg)}
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick replies (after first message) */}
        {messages.length > 0 && !isLoading && (
          <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto shrink-0 border-t border-surface-100" style={{ background: "var(--color-surface-0)" }}>
            {QUICK_REPLIES.map((text) => (
              <button
                key={text}
                onClick={() => sendMessage(text)}
                className="text-xs px-2.5 py-1 rounded-full border border-surface-200 text-surface-500 hover:text-primary-600 hover:border-primary-200 hover:bg-primary-50 transition-colors whitespace-nowrap shrink-0"
              >
                {text}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="px-3 py-2.5 flex items-center gap-2 shrink-0 border-t border-surface-100"
          style={{ background: "var(--color-surface-0)" }}
        >
          <input
            ref={inputRef}
            id="tiza-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribile a Tiza…"
            disabled={isLoading}
            className="flex-1 text-sm px-3 py-2 rounded-xl bg-surface-50 border border-surface-200 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all placeholder:text-surface-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-xl flex items-center justify-center trazos-gradient text-white disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md transition-all shrink-0"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>
      </div>
    </>
  );
}
