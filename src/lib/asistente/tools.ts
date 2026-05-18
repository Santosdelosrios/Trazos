// ============================================================
// Definición de Tools (Function Declarations) para Gemini
// Cada tool mapea a una operación en Supabase.
// ============================================================

/**
 * Todas las function declarations que Gemini puede invocar.
 * Se pasan al modelo como `tools: [{ functionDeclarations }]`.
 */
export const TOOL_DECLARATIONS = [
  {
    name: "buscar_alumno",
    description:
      "Busca alumnos del docente por nombre o apellido (búsqueda parcial, case-insensitive). Devuelve hasta 5 resultados con id, nombre, apellido y nivel educativo. SIEMPRE usá esta función antes de cualquier acción que necesite un alumno.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Nombre, apellido o fragmento para buscar. Ej: 'Elena', 'Pérez', 'Ele'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "agendar_clases",
    description:
      "Crea registros en la agenda de la maestra para una o varias fechas específicas. Usá esta función para agendar clases individuales o recurrentes calculando vos las fechas exactas.",
    parameters: {
      type: "object",
      properties: {
        alumno_id: {
          type: "string",
          description: "UUID del alumno (obtenido de buscar_alumno)",
        },
        fechas: {
          type: "array",
          items: { type: "string" },
          description:
            "Lista de fechas en formato YYYY-MM-DD. Ejemplo: ['2026-06-05', '2026-06-12'].",
        },
        hora: {
          type: "string",
          description: "Hora en formato HH:MM (24h). Ej: '15:00', '09:30'",
        },
        duracion_estimada: {
          type: "number",
          description: "Duración estimada en horas. Default: 1",
        },
        confirmacion_feriado: {
          type: "boolean",
          description: "Seteá esto en 'true' ÚNICAMENTE si la maestra ya confirmó explícitamente que quiere agendar en esa fecha a pesar de ser feriado.",
        },
      },
      required: ["alumno_id", "fechas", "hora"],
    },
  },
  {
    name: "cancelar_clases",
    description:
      "Elimina clases de la agenda para un alumno en fechas específicas. Usá esto si la maestra pide borrar o anular clases ya agendadas.",
    parameters: {
      type: "object",
      properties: {
        alumno_id: {
          type: "string",
          description: "UUID del alumno",
        },
        fechas: {
          type: "array",
          items: { type: "string" },
          description: "Lista de fechas (YYYY-MM-DD) a cancelar.",
        },
      },
      required: ["alumno_id", "fechas"],
    },
  },
  {
    name: "registrar_pago",
    description:
      "Registra un cobro para una clase de un alumno. Puede marcar un pago pendiente como 'pagado' o crear uno nuevo. Si no se especifica monto, usa la tarifa activa.",
    parameters: {
      type: "object",
      properties: {
        alumno_id: {
          type: "string",
          description: "UUID del alumno",
        },
        fecha: {
          type: "string",
          description:
            "Fecha de la clase en formato YYYY-MM-DD. Usar la fecha actual si la maestra dice 'hoy'.",
        },
        monto: {
          type: "number",
          description: "Monto cobrado. Si no se especifica, se usa la tarifa activa.",
        },
        estado: {
          type: "string",
          description: "Estado del pago: 'pagado' o 'parcial'. Default: 'pagado'.",
        },
      },
      required: ["alumno_id", "fecha"],
    },
  },
  {
    name: "consultar_saldo",
    description:
      "Consulta cuántas clases se dictaron, cuánto se facturó, cuánto se cobró y cuánto queda pendiente de un alumno.",
    parameters: {
      type: "object",
      properties: {
        alumno_id: {
          type: "string",
          description: "UUID del alumno",
        },
      },
      required: ["alumno_id"],
    },
  },
  {
    name: "ver_agenda_dia",
    description:
      "Muestra las clases agendadas para un día específico. Si no se indica fecha, muestra las de hoy. Incluye nombre del alumno, hora y estado.",
    parameters: {
      type: "object",
      properties: {
        fecha: {
          type: "string",
          description:
            "Fecha en formato YYYY-MM-DD. Usar la fecha actual para 'hoy', la de mañana para 'mañana'.",
        },
      },
      required: ["fecha"],
    },
  },
  {
    name: "resumen_financiero",
    description:
      "Devuelve un resumen financiero del mes actual: ingresos, gastos, ganancia neta y cantidad de pagos pendientes.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "organizar_cobro_mes",
    description:
      "Recopila toda la información necesaria para armar un mensaje de cobro mensual para un alumno: clases del mes indicado, clases pendientes de meses anteriores, tarifa activa y saldo. Usá esta herramienta cuando la maestra pida 'organizar el mes', 'armar el cobro', 'preparar el mensaje' o similares para un alumno. NO genera el mensaje final: solo devuelve datos para que vos le preguntes a la maestra si quiere ajustar algo (descuento, bonificación, cambio de tarifa) antes de redactar.",
    parameters: {
      type: "object",
      properties: {
        alumno_id: {
          type: "string",
          description: "UUID del alumno (obtenido de buscar_alumno)",
        },
        mes: {
          type: "number",
          description: "Número del mes a consultar (1-12). Ej: 4 para abril.",
        },
        anio: {
          type: "number",
          description: "Año a consultar. Ej: 2026.",
        },
      },
      required: ["alumno_id", "mes", "anio"],
    },
  },
  {
    name: "consultar_feriados",
    description:
      "Consulta la lista oficial de feriados de Argentina para un año específico. SIEMPRE usá esta función si la maestra te pregunta por feriados, días no laborables o antes de confirmar fechas en el calendario.",
    parameters: {
      type: "object",
      properties: {
        anio: {
          type: "number",
          description: "Año a consultar (ej. 2026).",
        },
      },
      required: ["anio"],
    },
  },
] as const;

