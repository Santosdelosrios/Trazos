"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import type { CategoriaGasto, EstadoPago, MedioPago } from "@/lib/types/database";
import {
  GuardarTarifaSchema,
  RegistrarGastoSchema,
  RegistrarPagoSchema,
  CargarCreditosSchema,
  RegistrarPagoCuentaCorrienteSchema,
  ConfirmarPagoSchema,
} from "@/lib/validations/schemas";
import { TAG } from "@/lib/db/tags";
import { validarImputacionManual } from "@/lib/finanzas/imputacion";
import type { LineaImputacion } from "@/lib/finanzas/imputacion";

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
  categoria_id?: string | null;
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

  // Dual-write PR-6: si vino categoria_id, leemos su enum_legacy para
  // popular `categoria` (NOT NULL). Si vino solo el enum (form viejo),
  // intentamos resolver el categoria_id de la default que mappea.
  let categoriaEnum = parsed.data.categoria;
  let categoriaId = parsed.data.categoria_id ?? null;

  if (categoriaId) {
    const { data: cat } = await supabase
      .from("categorias_gasto_activas")
      .select("enum_legacy")
      .eq("id", categoriaId)
      .eq("maestra_id", user.id)
      .maybeSingle();
    if (!cat) throw new Error("La categoría seleccionada ya no existe.");
    // Si la categoría custom no tiene enum_legacy mapeado (ej:
    // "Capacitación" o una creada por la maestra), caemos a "otro".
    categoriaEnum = (cat.enum_legacy as CategoriaGasto | null) ?? "otro";
  } else {
    // Solo vino el enum legacy: buscamos la default correspondiente.
    const { data: cat } = await supabase
      .from("categorias_gasto_activas")
      .select("id")
      .eq("maestra_id", user.id)
      .eq("enum_legacy", categoriaEnum)
      .eq("es_default", true)
      .maybeSingle();
    categoriaId = cat?.id ?? null;
  }

  const { error } = await supabase.from("gastos").insert({
    maestra_id: user.id,
    categoria: categoriaEnum,
    categoria_id: categoriaId,
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Soft delete: las queries de listado usan gastos_activos que filtra
  // deleted_at IS NULL, así que para la maestra es invisible. Para
  // auditoría queda la fila marcada con timestamp.
  const { error } = await supabase
    .from("gastos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("maestra_id", user.id)
    .is("deleted_at", null);
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
    .eq("id", id)
    .is("deleted_at", null);

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
    .eq("maestra_id", user.id)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  revalidateTag(TAG.PAGOS, "max");
  revalidateTag(TAG.RESUMEN_FINANCIERO, "max");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/cobranzas");
  revalidatePath("/dashboard");
}

export async function eliminarPago(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Soft delete: queda invisible para listados (filtran vía pagos_activos)
  // pero conservamos la fila para auditoría y para no romper FKs
  // (imputaciones_pago, movimientos_cuenta) que la referencian.
  const { error } = await supabase
    .from("pagos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("maestra_id", user.id)
    .is("deleted_at", null);
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

// ============================================================
// CONFIRMAR PAGO — PR-3
//
// Reemplaza el flujo "marcar pagado" directo. Flujo:
//  1. La maestra abre el modal de confirmación de un pago pendiente.
//  2. El modal valida y sube el comprobante (si hay) al Storage,
//     obteniendo el `path`.
//  3. Se llama a esta action con todos los campos + las imputaciones.
//  4. Action: update del pago (estado, medio, fecha, comprobante,
//     nota) + insert de imputaciones_pago.
//
// Las imputaciones son opcionales (si el pago no se asocia a clases
// específicas — ej. abono mensual — la lista queda vacía).
// ============================================================

export async function confirmarPago(input: {
  pago_id: string;
  monto: number;
  estado: EstadoPago;          // pagado | parcial
  medio_pago: MedioPago;
  fecha_pago: string;          // YYYY-MM-DD
  comprobante_url?: string | null;
  nota?: string | null;
  imputaciones?: LineaImputacion[];
}) {
  const parsed = ConfirmarPagoSchema.safeParse({
    pago_id: input.pago_id,
    monto: input.monto,
    estado: input.estado,
    medio_pago: input.medio_pago,
    fecha_pago: input.fecha_pago,
    comprobante_url: input.comprobante_url || undefined,
    nota: input.nota || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Verificamos que el pago exista y sea de la maestra
  const { data: pagoExistente } = await supabase
    .from("pagos_activos")
    .select("id, alumno_id, monto")
    .eq("id", parsed.data.pago_id)
    .eq("maestra_id", user.id)
    .maybeSingle();
  if (!pagoExistente) throw new Error("El cobro ya no existe o no es tuyo.");

  // Validamos imputaciones contra clases pendientes
  const imputaciones = input.imputaciones ?? [];
  if (imputaciones.length > 0) {
    const { data: pendientesRaw } = await supabase.rpc(
      "clases_pendientes_imputacion",
      { p_alumno_id: pagoExistente.alumno_id }
    );
    const pendientes = (pendientesRaw ?? []) as Array<{
      clase_id: string; fecha: string; tema: string;
      monto_total: number; monto_imputado: number; pendiente: number;
    }>;
    validarImputacionManual(pendientes, imputaciones, parsed.data.monto);
  }

  // 1. Update del pago
  const { error: errUpdate } = await supabase
    .from("pagos")
    .update({
      monto: parsed.data.monto,
      estado: parsed.data.estado,
      medio_pago: parsed.data.medio_pago,
      fecha_pago: parsed.data.fecha_pago,
      comprobante_url: parsed.data.comprobante_url || null,
      nota: parsed.data.nota || null,
    })
    .eq("id", parsed.data.pago_id)
    .eq("maestra_id", user.id)
    .is("deleted_at", null);
  if (errUpdate) throw new Error("Error al confirmar el cobro: " + errUpdate.message);

  // 2. Insert de imputaciones (si las hay).
  //    Idempotencia: primero borramos las anteriores del mismo pago
  //    por si la maestra reabre el modal y cambia el reparto.
  if (imputaciones.length > 0) {
    await supabase.from("imputaciones_pago").delete().eq("pago_id", parsed.data.pago_id);
    const filas = imputaciones.map((i) => ({
      pago_id: parsed.data.pago_id,
      clase_id: i.clase_id,
      monto_imputado: i.monto_imputado,
    }));
    const { error: errImp } = await supabase.from("imputaciones_pago").insert(filas);
    if (errImp) throw new Error("Error al guardar imputaciones: " + errImp.message);
  }

  revalidateTag(TAG.PAGOS, "max");
  revalidateTag(TAG.RESUMEN_FINANCIERO, "max");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/cobranzas");
  revalidatePath("/dashboard");
}

