"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CategoriaGasto, EstadoPago } from "@/lib/types/database";

// ============================================================
// TARIFAS
// ============================================================

export async function guardarTarifa(data: {
  valor_hora: number;
  notas?: string;
}) {
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
    valor_hora: data.valor_hora,
    vigente_desde: new Date().toISOString().split("T")[0],
    activa: true,
    notas: data.notas || null,
  });

  if (error) throw new Error(error.message);

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("gastos").insert({
    maestra_id: user.id,
    categoria: data.categoria,
    descripcion: data.descripcion || null,
    monto: data.monto,
    fecha: data.fecha,
    recurrente: data.recurrente,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/finanzas");
  revalidatePath("/finanzas/gastos");
}

export async function eliminarGasto(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("gastos").delete().eq("id", id);
  if (error) throw new Error(error.message);

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
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("pagos").insert({
    maestra_id: user.id,
    alumno_id: data.alumno_id,
    clase_id: data.clase_id || null,
    monto: data.monto,
    estado: data.estado,
    fecha_pago: data.fecha_pago || null,
    nota: data.nota || null,
  });

  if (error) throw new Error(error.message);

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

  revalidatePath("/finanzas");
  revalidatePath("/finanzas/cobranzas");
  revalidatePath("/dashboard");
}

export async function eliminarPago(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pagos").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/finanzas");
  revalidatePath("/finanzas/cobranzas");
}
