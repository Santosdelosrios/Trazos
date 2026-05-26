"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import type { CategoriaGasto, EstadoPago } from "@/lib/types/database";
import {
  GuardarTarifaSchema,
  RegistrarGastoSchema,
  RegistrarPagoSchema,
  CargarCreditosSchema,
  RegistrarPagoCuentaCorrienteSchema,
} from "@/lib/validations/schemas";
import { TAG } from "@/lib/db/tags";

// ============================================================
// TARIFAS
// ============================================================

export async function guardarTarifa(data: {
  valor_hora: number;
  notas?: string;
}) {
  // Validación zod centralizada
  const parsed = GuardarTarifaSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Desactivar tarifas anteriores
  await supabase
    .from("tarifas")
    .update({ activa: false })
    .eq("maestra_id", user.id)
    .eq("activa", true);

  // Crear nueva tarifa activa
  const { error } = await supabase.from("tarifas").insert({
    maestra_id: user.id,
    valor_hora: parsed.data.valor_hora,
    vigente_desde: new Date().toISOString().split("T")[0],
    activa: true,
    notas: data.notas || null,
  });

  if (error) throw new Error(error.message);

  revalidateTag(TAG.TARIFAS, "max");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/tarifas");
}

// ============================================================
// GASTOS
// ============================================================

export async function registrarGasto(data: {
  categoria: CategoriaGasto;
  descripcion?: string;
  monto: number;
  fecha: string;
  recurrente: boolean;
}) {
  const parsed = RegistrarGastoSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("gastos").insert({
    maestra_id: user.id,
    categoria: parsed.data.categoria,
    descripcion: parsed.data.descripcion || null,
    monto: parsed.data.monto,
    fecha: parsed.data.fecha,
    recurrente: parsed.data.recurrente,
  });

  if (error) throw new Error(error.message);

  revalidateTag(TAG.GASTOS, "max");
  revalidateTag(TAG.RESUMEN_FINANCIERO, "max");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/gastos");
}

export async function eliminarGasto(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("gastos").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateTag(TAG.GASTOS, "max");
  revalidateTag(TAG.RESUMEN_FINANCIERO, "max");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/gastos");
}

// ============================================================
// PAGOS / COBRANZAS
// ============================================================

export async function registrarPago(data: {
  alumno_id: string;
  clase_id?: string;
  monto: number;
  estado: EstadoPago;
  fecha_pago?: string;
  nota?: string;
  periodo?: string;
}) {
  // Validamos sin clase_id (que es opcional y solo se setea internamente)
  const parsed = RegistrarPagoSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("pagos").insert({
    maestra_id: user.id,
    alumno_id: parsed.data.alumno_id,
    clase_id: data.clase_id || null,
    monto: parsed.data.monto,
    estado: parsed.data.estado,
    fecha_pago: parsed.data.fecha_pago || null,
    nota: parsed.data.nota || null,
    periodo: parsed.data.periodo || null,
  });

  if (error) throw new Error(error.message);

  revalidateTag(TAG.PAGOS, "max");
  revalidateTag(TAG.RESUMEN_FINANCIERO, "max");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/cobranzas");
  revalidatePath("/dashboard");
}

export async function actualizarEstadoPago(id: string, estado: EstadoPago) {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = { estado };
  if (estado === "pagado") {
    updateData.fecha_pago = new Date().toISOString().split("T")[0];
  }

  const { error } = await supabase
    .from("pagos")
    .update(updateData)
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidateTag(TAG.PAGOS, "max");
  revalidateTag(TAG.RESUMEN_FINANCIERO, "max");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/cobranzas");
  revalidatePath("/dashboard");
}

export async function actualizarPago(id: string, data: {
  monto: number;
  estado: EstadoPago;
  fecha_pago?: string | null;
  nota?: string | null;
  periodo?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Validamos con el mismo schema usado en la creación (acepta el subset)
  const parsed = RegistrarPagoSchema.omit({ alumno_id: true }).safeParse({
    monto: data.monto,
    estado: data.estado,
    fecha_pago: data.fecha_pago || undefined,
    nota: data.nota || undefined,
    periodo: data.periodo || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const { error } = await supabase
    .from("pagos")
    .update({
      monto: parsed.data.monto,
      estado: parsed.data.estado,
      fecha_pago: parsed.data.fecha_pago || null,
      nota: parsed.data.nota || null,
      periodo: parsed.data.periodo || null,
    })
    .eq("id", id)
    .eq("maestra_id", user.id);

  if (error) throw new Error(error.message);

  revalidateTag(TAG.PAGOS, "max");
  revalidateTag(TAG.RESUMEN_FINANCIERO, "max");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/cobranzas");
  revalidatePath("/dashboard");
}

export async function eliminarPago(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pagos").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateTag(TAG.PAGOS, "max");
  revalidateTag(TAG.RESUMEN_FINANCIERO, "max");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/cobranzas");
}

// ============================================================
// ABONOS MENSUALES
// ============================================================

export async function guardarAbono(data: {
  alumno_id: string;
  monto_mensual: number;
  notas?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Desactivar abono anterior si existe
  await supabase
    .from("abonos")
    .update({ activo: false })
    .eq("alumno_id", data.alumno_id)
    .eq("maestra_id", user.id)
    .eq("activo", true);

  const { error } = await supabase.from("abonos").insert({
    maestra_id: user.id,
    alumno_id: data.alumno_id,
    monto_mensual: data.monto_mensual,
    activo: true,
    vigente_desde: new Date().toISOString().split("T")[0],
    notas: data.notas || null,
  });

  if (error) throw new Error(error.message);

  revalidateTag(TAG.PAGOS, "max");
  revalidateTag(TAG.RESUMEN_FINANCIERO, "max");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/cobranzas");
}

// ============================================================
// BOLSA DE CRÉDITOS
// ============================================================

export async function cargarCreditos(data: {
  alumno_id: string;
  creditos: number;
  monto: number;
  nota?: string;
}) {
  const parsed = CargarCreditosSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // 1. Registrar el pago monetario
  const { data: pago, error: errPago } = await supabase.from("pagos").insert({
    maestra_id: user.id,
    alumno_id: data.alumno_id,
    monto: data.monto,
    estado: "pagado",
    fecha_pago: new Date().toISOString().split("T")[0],
    nota: data.nota || `Pack de ${data.creditos} créditos`,
  }).select("id").single();

  if (errPago) throw new Error(errPago.message);

  // 2. Registrar movimiento con créditos positivos
  const { error: errMov } = await supabase.from("movimientos_cuenta").insert({
    maestra_id: user.id,
    alumno_id: data.alumno_id,
    tipo_movimiento: "pago_ingresado",
    monto: data.monto,
    creditos: data.creditos,
    referencia_id: pago?.id || null,
    descripcion: `Pack de ${data.creditos} clases`,
  });

  if (errMov) throw new Error(errMov.message);

  revalidateTag(TAG.PAGOS, "max");
  revalidateTag(TAG.RESUMEN_FINANCIERO, "max");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/cobranzas");
  revalidatePath("/dashboard");
}

// ============================================================
// CUENTA CORRIENTE — Pago a favor
// ============================================================

export async function registrarPagoCuentaCorriente(data: {
  alumno_id: string;
  monto: number;
  nota?: string;
}) {
  const parsed = RegistrarPagoCuentaCorrienteSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // 1. Registrar el pago
  const { data: pago, error: errPago } = await supabase.from("pagos").insert({
    maestra_id: user.id,
    alumno_id: data.alumno_id,
    monto: data.monto,
    estado: "pagado",
    fecha_pago: new Date().toISOString().split("T")[0],
    nota: data.nota || null,
  }).select("id").single();

  if (errPago) throw new Error(errPago.message);

  // 2. Movimiento positivo (crédito a favor)
  const { error: errMov } = await supabase.from("movimientos_cuenta").insert({
    maestra_id: user.id,
    alumno_id: data.alumno_id,
    tipo_movimiento: "pago_ingresado",
    monto: data.monto,
    creditos: 0,
    referencia_id: pago?.id || null,
    descripcion: data.nota || "Pago recibido",
  });

  if (errMov) throw new Error(errMov.message);

  revalidateTag(TAG.PAGOS, "max");
  revalidateTag(TAG.RESUMEN_FINANCIERO, "max");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/cobranzas");
  revalidatePath("/dashboard");
}

