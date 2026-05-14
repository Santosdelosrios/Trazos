import { NextResponse } from "next/server";
import feriadosLocales from "@/data/feriados2026.json";

/**
 * Proxy API Route para obtener feriados de Argentina.
 * Centraliza las peticiones para evitar errores de CORS en el cliente.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anio = searchParams.get("anio") || new Date().getFullYear().toString();

  try {
    const response = await fetch(
      `https://nolaborables.com.ar/api/v2/feriados/${anio}?incluir=opcional`,
      {
        next: { revalidate: 86400 }, // Cache de 24hs
        signal: AbortSignal.timeout(2000), // 2 segundos de gracia (timeout corto)
      }
    );

    if (!response.ok) {
      throw new Error(`API Externa respondió con status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    // Fallback: Si falla la API externa, devolvemos el JSON local estático.
    console.warn("⚠️ Proxy de Feriados: Fallo en origen o timeout. Usando fallback local.", error.message);
    
    return NextResponse.json(feriadosLocales, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    });
  }
}
