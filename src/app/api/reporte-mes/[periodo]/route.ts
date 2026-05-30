import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { getDatosReporteMes, nombreMes, type DatosReporteMes } from "@/lib/finanzas/reporteMes";

export const runtime = "nodejs";

// ============================================================
// GET /api/reporte-mes/[periodo]
// periodo formato: YYYY-MM (ej: 2026-05)
//
// Devuelve un PDF A4 vertical con el cierre del mes para presentar
// a contador / AFIP / archivo personal de la maestra.
// ============================================================

const A4 = { width: 595.28, height: 841.89 };
const MARGIN_X = 48;
const COLORS = {
  text:    rgb(0.12, 0.16, 0.22),
  muted:   rgb(0.40, 0.44, 0.52),
  light:   rgb(0.65, 0.69, 0.75),
  divider: rgb(0.90, 0.92, 0.94),
  green:   rgb(0.13, 0.69, 0.30),
  red:     rgb(0.86, 0.22, 0.22),
  primary: rgb(0.20, 0.30, 0.85),
  amber:   rgb(0.85, 0.55, 0.10),
};

function parsePeriodo(periodo: string): { anio: number; mes: number } | null {
  const m = periodo.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const anio = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10);
  if (mes < 1 || mes > 12 || anio < 2000 || anio > 2100) return null;
  return { anio, mes };
}

function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(n);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ periodo: string }> }
) {
  const { periodo } = await ctx.params;
  const parsed = parsePeriodo(periodo);
  if (!parsed) {
    return NextResponse.json({ error: "Formato inválido. Usar YYYY-MM." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("No autenticado", { status: 401 });
  }

  const datos = await getDatosReporteMes(supabase, user.id, parsed.anio, parsed.mes);
  if (!datos) {
    return new Response("No se pudo generar el reporte.", { status: 500 });
  }

  const pdfBytes = await construirPdf(datos);

  return new Response(pdfBytes as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="reporte-${periodo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

// ============================================================
// Composición del PDF
// ============================================================

async function construirPdf(d: DatosReporteMes): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4.width, A4.height]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ctx = { pdf, page, font, fontBold, y: A4.height - 56 };

  // Header
  drawText(ctx, "Reporte de cierre de mes", { font: fontBold, size: 22 });
  ctx.y -= 22;
  const mesNombre = `${nombreMes(d.periodo.mes)} ${d.periodo.anio}`;
  drawText(ctx, mesNombre, { font: fontBold, size: 32, color: COLORS.primary });
  ctx.y -= 14;
  drawText(ctx, d.maestra.nombre, { font, size: 14, color: COLORS.muted });
  ctx.y -= 8;
  const emision = new Date().toLocaleDateString("es-AR", {
    day: "numeric", month: "long", year: "numeric",
  });
  drawText(ctx, `Emitido el ${emision}`, { font, size: 9, color: COLORS.light });
  ctx.y -= 24;

  divider(ctx);

  // Resumen
  drawSection(ctx, "Resumen del mes");
  ctx.y -= 4;
  drawGrid3(ctx, [
    { label: "Ingresos", valor: formatARS(d.resumen.ingresos), color: COLORS.green },
    { label: "Gastos",   valor: formatARS(d.resumen.gastos),   color: COLORS.red },
    {
      label: "Ganancia neta",
      valor: formatARS(d.resumen.neto),
      color: d.resumen.neto >= 0 ? COLORS.primary : COLORS.red,
    },
  ]);
  ctx.y -= 8;
  drawText(ctx,
    `Movimientos: ${d.resumen.cant_pagos} ${d.resumen.cant_pagos === 1 ? "cobro" : "cobros"}, ${d.resumen.cant_gastos} ${d.resumen.cant_gastos === 1 ? "gasto" : "gastos"}.`,
    { font, size: 10, color: COLORS.muted });
  ctx.y -= 22;

  // Comparativa vs mes anterior
  drawSection(ctx, "Comparativa con el mes anterior");
  ctx.y -= 4;
  drawComparativa(ctx, d);
  ctx.y -= 22;

  divider(ctx);

  // Top alumnos
  if (d.top_alumnos.length > 0) {
    drawSection(ctx, "Top alumnos por facturación");
    ctx.y -= 4;
    for (const a of d.top_alumnos) {
      drawRow(ctx, a.nombre, `${a.cant_clases} ${a.cant_clases === 1 ? "clase" : "clases"}`, formatARS(a.total));
    }
    ctx.y -= 12;
  }

  // Top familias
  if (d.top_familias.length > 0) {
    drawSection(ctx, "Top familias por facturación");
    ctx.y -= 4;
    for (const f of d.top_familias) {
      drawRow(ctx, f.nombre, "", formatARS(f.total));
    }
    ctx.y -= 12;
  }

  divider(ctx);

  // Gastos por categoría
  drawSection(ctx, "Gastos por categoría");
  ctx.y -= 4;
  if (d.gastos_por_categoria.length === 0) {
    drawText(ctx, "No se registraron gastos este mes.", { font, size: 10, color: COLORS.muted });
    ctx.y -= 14;
  } else {
    for (const g of d.gastos_por_categoria) {
      drawRow(ctx, g.nombre, `${g.cant} ${g.cant === 1 ? "movimiento" : "movimientos"}`, formatARS(g.total));
    }
  }

  // Footer
  drawFooter(ctx);

  return await pdf.save();
}

// ============================================================
// Primitivas de dibujo
// ============================================================

interface Ctx {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
}

function drawText(
  ctx: Ctx,
  text: string,
  opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number } = {}
) {
  const size = opts.size ?? 11;
  const f = opts.font ?? ctx.font;
  ctx.page.drawText(text, {
    x: opts.x ?? MARGIN_X,
    y: ctx.y,
    size,
    font: f,
    color: opts.color ?? COLORS.text,
  });
  ctx.y -= size + 2;
}

function divider(ctx: Ctx) {
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end:   { x: A4.width - MARGIN_X, y: ctx.y },
    thickness: 0.5,
    color: COLORS.divider,
  });
  ctx.y -= 18;
}

function drawSection(ctx: Ctx, titulo: string) {
  drawText(ctx, titulo.toUpperCase(), {
    font: ctx.fontBold, size: 10, color: COLORS.muted,
  });
}

function drawGrid3(
  ctx: Ctx,
  items: { label: string; valor: string; color: ReturnType<typeof rgb> }[]
) {
  const colW = (A4.width - 2 * MARGIN_X) / 3;
  const yLabel = ctx.y;
  for (let i = 0; i < items.length; i++) {
    const x = MARGIN_X + i * colW;
    ctx.page.drawText(items[i].label.toUpperCase(), {
      x, y: yLabel, size: 9, font: ctx.font, color: COLORS.muted,
    });
    ctx.page.drawText(items[i].valor, {
      x, y: yLabel - 18, size: 18, font: ctx.fontBold, color: items[i].color,
    });
  }
  ctx.y = yLabel - 28;
}

function drawComparativa(ctx: Ctx, d: DatosReporteMes) {
  // Nota: la fuente estándar de pdf-lib usa codificación WinAnsi y no
  // puede dibujar flechas Unicode (↑ ↓ →) — usar texto plano.
  const tendencia = (v: number) => (v > 0 ? "subió" : v < 0 ? "bajó" : "sin cambios");
  const lines: string[] = [];
  if (d.comparativo.var_ingresos_pct != null) {
    const v = d.comparativo.var_ingresos_pct;
    lines.push(
      `Ingresos: ${formatARS(d.resumen.ingresos)} vs ${formatARS(d.comparativo.ingresos_anterior)} (${tendencia(v)} ${Math.abs(v)}%)`
    );
  } else {
    lines.push(`Ingresos: ${formatARS(d.resumen.ingresos)} - sin dato comparable.`);
  }
  if (d.comparativo.var_neto_pct != null) {
    const v = d.comparativo.var_neto_pct;
    lines.push(
      `Neto: ${formatARS(d.resumen.neto)} vs ${formatARS(d.comparativo.neto_anterior)} (${tendencia(v)} ${Math.abs(v)}%)`
    );
  } else {
    lines.push(`Neto: ${formatARS(d.resumen.neto)} - sin dato comparable.`);
  }
  for (const l of lines) drawText(ctx, l, { size: 11 });
}

function drawRow(ctx: Ctx, izq: string, centro: string, der: string) {
  const yRow = ctx.y;
  // truncar nombres largos
  const maxLeftWidth = (A4.width - 2 * MARGIN_X) * 0.55;
  const izqTrunc = truncarTexto(izq, ctx.font, 11, maxLeftWidth);
  ctx.page.drawText(izqTrunc, { x: MARGIN_X, y: yRow, size: 11, font: ctx.font, color: COLORS.text });
  if (centro) {
    ctx.page.drawText(centro, {
      x: MARGIN_X + maxLeftWidth + 12,
      y: yRow, size: 9, font: ctx.font, color: COLORS.muted,
    });
  }
  const wDer = ctx.fontBold.widthOfTextAtSize(der, 11);
  ctx.page.drawText(der, {
    x: A4.width - MARGIN_X - wDer, y: yRow,
    size: 11, font: ctx.fontBold, color: COLORS.text,
  });
  ctx.y -= 16;
}

function truncarTexto(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

function drawFooter(ctx: Ctx) {
  const yFooter = 28;
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: yFooter + 14 },
    end:   { x: A4.width - MARGIN_X, y: yFooter + 14 },
    thickness: 0.5,
    color: COLORS.divider,
  });
  ctx.page.drawText("Trazos", {
    x: MARGIN_X, y: yFooter, size: 9, font: ctx.fontBold, color: COLORS.amber,
  });
  const url = "trazos.app";
  ctx.page.drawText(url, {
    x: A4.width - MARGIN_X - ctx.font.widthOfTextAtSize(url, 8),
    y: yFooter, size: 8, font: ctx.font, color: COLORS.light,
  });
}
