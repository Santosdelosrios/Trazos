import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { getDatosComprobante } from "@/lib/finanzas/datosComprobante";
import { formatearMonto } from "@/lib/finanzas/formatearMonto";
import { MEDIO_PAGO_LABELS } from "@/lib/types/database";

// Node runtime: nuestro server client lee cookies de Next; el adapter
// edge tiene quirks con @supabase/ssr. ImageResponse funciona en ambos.
export const runtime = "nodejs";

/**
 * Devuelve el comprobante de un pago como imagen PNG (1080x1350,
 * formato vertical pensado para WhatsApp / stories).
 *
 * - 200 PNG si el pago existe, es de la maestra y está pagado/parcial.
 * - 401 si no hay sesión.
 * - 404 si el pago no existe o no es suyo.
 * - 400 si el pago aún no fue cobrado (no tiene sentido un comprobante
 *   de un pendiente).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ pagoId: string }> }
) {
  const { pagoId } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("No autenticado", { status: 401 });
  }

  const datos = await getDatosComprobante(supabase, pagoId, user.id);
  if (!datos) {
    return new Response("Comprobante no encontrado", { status: 404 });
  }
  if (datos.pago.estado !== "pagado" && datos.pago.estado !== "parcial") {
    return new Response("El cobro aún no fue confirmado", { status: 400 });
  }

  const fechaPago = datos.pago.fecha_pago ?? datos.pago.created_at.slice(0, 10);
  const medioLabel = datos.pago.medio_pago
    ? MEDIO_PAGO_LABELS[datos.pago.medio_pago]
    : "—";
  const nombreAlumno = `${datos.alumno.nombre} ${datos.alumno.apellido}`.trim();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #fefce8 0%, #ffffff 60%)",
          padding: "60px 56px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#1f2937",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 18, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 2 }}>
              Comprobante de pago
            </span>
            <span style={{ fontSize: 44, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
              {datos.maestra.nombre}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 800,
              color: "#22c55e",
              background: "#dcfce7",
              padding: "8px 16px",
              borderRadius: 16,
            }}
          >
            ✓ {datos.pago.estado === "pagado" ? "Pagado" : "Parcial"}
          </div>
        </div>

        {/* Separador */}
        <div style={{ height: 2, background: "#e5e7eb", marginTop: 28, marginBottom: 28, display: "flex" }} />

        {/* Metadata: alumno, fecha, medio */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Fila label="Alumno/a" valor={nombreAlumno} />
          {datos.alumno.familia_nombre && (
            <Fila label="Familia" valor={datos.alumno.familia_nombre} />
          )}
          <Fila label="Fecha" valor={formatFechaLarga(fechaPago)} />
          <Fila label="Medio" valor={medioLabel} />
        </div>

        {/* Detalle de clases */}
        {datos.lineas.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
            <span style={{ fontSize: 18, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
              Detalle
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              {datos.lineas.map((l, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 22px",
                    borderTop: idx === 0 ? "none" : "1px solid #f3f4f6",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, marginRight: 12 }}>
                    <span style={{ fontSize: 24, fontWeight: 600, color: "#0f172a" }}>{l.tema}</span>
                    <span style={{ fontSize: 18, color: "#9ca3af", marginTop: 2 }}>{formatFechaCorta(l.fecha)}</span>
                  </div>
                  <span style={{ fontSize: 26, fontWeight: 700, color: "#0f172a" }}>
                    {formatearMonto(l.monto)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 36,
            padding: "22px 26px",
            background: "linear-gradient(90deg, #fde68a, #fef3c7)",
            borderRadius: 18,
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: 1.5 }}>
            Total
          </span>
          <span style={{ fontSize: 44, fontWeight: 900, color: "#1f2937" }}>
            {formatearMonto(datos.total)}
          </span>
        </div>

        {/* Nota (si hay) */}
        {datos.pago.nota && (
          <div style={{ display: "flex", marginTop: 20, fontSize: 18, color: "#6b7280", fontStyle: "italic" }}>
            {datos.pago.nota}
          </div>
        )}

        {/* Spacer */}
        <div style={{ display: "flex", flex: 1 }} />

        {/* Footer: marca Trazos */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            paddingTop: 24,
            borderTop: "1px solid #e5e7eb",
            fontSize: 16,
            color: "#9ca3af",
            fontWeight: 600,
            letterSpacing: 1,
          }}
        >
          Trazos · {formatFechaCorta(new Date().toISOString())}
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
    }
  );
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
      <span style={{ fontSize: 20, color: "#6b7280", fontWeight: 600, width: 140 }}>
        {label}
      </span>
      <span style={{ fontSize: 26, color: "#0f172a", fontWeight: 600 }}>
        {valor}
      </span>
    </div>
  );
}

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatFechaLarga(yyyymmdd: string): string {
  const seguro = yyyymmdd.length >= 10 ? yyyymmdd.slice(0, 10) + "T12:00:00" : yyyymmdd;
  const d = new Date(seguro);
  const dia = d.getDate();
  const mes = MESES_LARGOS[d.getMonth()];
  const anio = d.getFullYear();
  return `${dia} de ${mes} de ${anio}`;
}

function formatFechaCorta(iso: string): string {
  const seguro = iso.length === 10 ? iso + "T12:00:00" : iso;
  const d = new Date(seguro);
  return `${d.getDate()} ${MESES_LARGOS[d.getMonth()].slice(0, 3)}`;
}
