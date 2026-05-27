// ============================================================
// comprobantes.ts — Helpers para subida de comprobantes de pago
//
// Bucket: comprobantes-pagos (privado, RLS por path)
// Path: <maestra_id>/<pago_id>/<nombre>
// Tipos aceptados: imágenes y PDF
// Tamaño máx: 5 MB (validado en cliente)
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET_COMPROBANTES = "comprobantes-pagos";
export const TAMANO_MAX_BYTES = 5 * 1024 * 1024;
export const TIPOS_MIME_ACEPTADOS = ["image/", "application/pdf"] as const;

export interface ResultadoSubida {
  path: string;
  /** URL firmada con TTL corto. Solo para preview/descarga, NO persistir. */
  urlFirmada?: string;
}

/** True si el MIME está dentro de los aceptados (image/* o application/pdf). */
export function tipoMimeAceptado(mime: string): boolean {
  return TIPOS_MIME_ACEPTADOS.some((prefix) => mime.startsWith(prefix) || mime === prefix.replace("/", ""));
}

/** Validación cliente-side: tamaño y tipo. Lanza con mensaje user-friendly. */
export function validarArchivoComprobante(file: File): void {
  if (file.size > TAMANO_MAX_BYTES) {
    throw new Error(
      `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. El máximo es 5 MB.`
    );
  }
  if (!tipoMimeAceptado(file.type)) {
    throw new Error("Solo se aceptan imágenes (JPG/PNG) o PDF.");
  }
}

/**
 * Sube un comprobante al bucket. Devuelve el `path` para persistir en
 * `pagos.comprobante_url` (no la URL firmada; esa se regenera al
 * mostrar el comprobante).
 *
 * Convención de nombre: `<maestra_id>/<pago_id>/<timestamp>-<sanitized>`
 * para evitar colisiones si la maestra reemplaza el comprobante.
 */
export async function subirComprobante(
  supabase: SupabaseClient,
  params: {
    maestraId: string;
    pagoId: string;
    archivo: File;
  }
): Promise<ResultadoSubida> {
  validarArchivoComprobante(params.archivo);

  const sanitized = params.archivo.name
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80);
  const path = `${params.maestraId}/${params.pagoId}/${Date.now()}-${sanitized}`;

  const { error } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .upload(path, params.archivo, {
      cacheControl: "3600",
      upsert: false,
      contentType: params.archivo.type,
    });

  if (error) throw new Error("No se pudo subir el comprobante: " + error.message);

  return { path };
}

/**
 * Devuelve una URL firmada de corto plazo para ver/descargar un
 * comprobante. NO se persiste; se regenera cada vez que se renderiza.
 */
export async function getUrlFirmadaComprobante(
  supabase: SupabaseClient,
  path: string,
  ttlSeconds = 60 * 10
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .createSignedUrl(path, ttlSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Borra un comprobante del bucket. Best-effort (no lanza si falla). */
export async function borrarComprobante(
  supabase: SupabaseClient,
  path: string
): Promise<void> {
  await supabase.storage.from(BUCKET_COMPROBANTES).remove([path]);
}
