import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Genera un archivo .ics (iCalendar) con todas las clases pendientes
 * de la maestra identificada por su calendar_token.
 * 
 * URL: /api/calendar/[token]
 * Uso: Copiar la URL y pegarla en Google Calendar → "Desde URL"
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const supabase = await createClient();

  // 1. Buscar la maestra por su token de calendario
  const { data: maestra, error: maestraError } = await supabase
    .from("maestras")
    .select("id, nombre")
    .eq("calendar_token", token)
    .maybeSingle();

  if (maestraError || !maestra) {
    return NextResponse.json(
      { error: "Token de calendario inválido" },
      { status: 404 }
    );
  }

  // 2. Obtener todas las clases pendientes de la agenda
  const { data: agenda } = await supabase
    .from("agenda")
    .select(`
      id, fecha, hora, tema_previsto, materia, duracion_estimada,
      alumnos (nombre, apellido)
    `)
    .eq("maestra_id", maestra.id)
    .eq("estado", "pendiente")
    .gte("fecha", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
    .order("fecha", { ascending: true });

  // 3. Generar el archivo .ics
  const events = (agenda || []).map((item: any) => {
    const alumnoNombre = item.alumnos
      ? `${item.alumnos.nombre} ${item.alumnos.apellido}`
      : "Alumno";

    const duracion = item.duracion_estimada || 1; // horas
    const fechaStr = item.fecha.replace(/-/g, "");
    const horaStr = item.hora.replace(/:/g, "").substring(0, 4) + "00";

    // Calcular hora de fin
    const startDate = new Date(`${item.fecha}T${item.hora}`);
    const endDate = new Date(startDate.getTime() + duracion * 60 * 60 * 1000);
    const endHoraStr =
      String(endDate.getHours()).padStart(2, "0") +
      String(endDate.getMinutes()).padStart(2, "0") +
      "00";

    const materiaLabel = item.materia
      ? item.materia.charAt(0).toUpperCase() + item.materia.slice(1).replace("_", " ")
      : "";

    return [
      "BEGIN:VEVENT",
      `UID:trazos-${item.id}@trazosdemaestra.com.ar`,
      `DTSTART:${fechaStr}T${horaStr}`,
      `DTEND:${fechaStr}T${endHoraStr}`,
      `SUMMARY:Clase con ${alumnoNombre}${materiaLabel ? ` - ${materiaLabel}` : ""}`,
      `DESCRIPTION:${item.tema_previsto ? `Tema: ${item.tema_previsto}` : "Sin tema definido"}`,
      `STATUS:CONFIRMED`,
      "END:VEVENT",
    ].join("\r\n");
  });

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trazos//Agenda//ES",
    `X-WR-CALNAME:Trazos - ${maestra.nombre}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="trazos-agenda.ics"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
