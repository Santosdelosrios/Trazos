import feriadosLocales from "@/data/feriados2026.json";

/**
 * Utilidad para obtener feriados de Argentina.
 * Centraliza la consulta a través de nuestro propio Proxy API para evitar CORS y lentitud.
 */

export interface Feriado {
  motivo: string;
  tipo: string; // inamovible | trasladable | puente
  dia: number;
  mes: number;
  id: string;
}

const memoryCache = new Map<number, Feriado[]>();

/**
 * Obtiene los feriados del año indicado.
 * Si se llama desde el cliente, usa nuestro Proxy /api/feriados.
 * Si se llama desde el servidor, consulta la API externa con fallback local.
 * Utiliza memoryCache para respuesta instantánea en múltiples consultas.
 */
export async function getFeriados(anio: number): Promise<Feriado[]> {
  if (memoryCache.has(anio)) {
    return memoryCache.get(anio)!;
  }

  try {
    const isClient = typeof window !== "undefined";

    // Si estamos en el cliente, usamos el proxy interno para evitar CORS
    if (isClient) {
      const response = await fetch(`/api/feriados?anio=${anio}`);
      if (!response.ok) return feriadosLocales as Feriado[];
      const data = await response.json();
      memoryCache.set(anio, data);
      return data;
    }

    // Si estamos en el servidor (ej: Tiza), consultamos la API externa
    // con un timeout agresivo y fallback al JSON local.
    const response = await fetch(
      `https://nolaborables.com.ar/api/v2/feriados/${anio}?incluir=opcional`,
      {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(2000),
      }
    );

    if (!response.ok) throw new Error("API externa falló");
    const data = await response.json();
    memoryCache.set(anio, data);
    return data;
  } catch (error) {
    console.warn("⚠️ Fallo al obtener feriados externos, usando fallback local:", error);
    const data = feriadosLocales as Feriado[];
    memoryCache.set(anio, data);
    return data;
  }
}

/**
 * Formatea un feriado para que sea legible por Tiza o la UI.
 */
export function formatFeriadoDate(f: Feriado, anio: number): string {
  const dia = String(f.dia).padStart(2, "0");
  const mes = String(f.mes).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}
