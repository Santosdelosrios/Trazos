// ============================================================
// Tipos del Agente Conversacional "Tiza"
// ============================================================

/** Mensaje individual del chat */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  actions?: ActionTaken[];
}

/** Acción ejecutada por el agente (para feedback visual) */
export interface ActionTaken {
  tool: string;
  summary: string;
  success: boolean;
}

/** Request body del POST /api/asistente */
export interface AsistenteRequest {
  message: string;
  history: GeminiHistoryEntry[];
}

/** Response body del POST /api/asistente */
export interface AsistenteResponse {
  reply: string;
  history: GeminiHistoryEntry[];
  actions: ActionTaken[];
}

/** Entrada del historial de Gemini (compatible con el SDK) */
export interface GeminiHistoryEntry {
  role: "user" | "model";
  parts: GeminiPart[];
}

export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

/** Resultado de la ejecución de una tool */
export interface ToolResult {
  success: boolean;
  data: Record<string, unknown>;
  summary: string;
}
