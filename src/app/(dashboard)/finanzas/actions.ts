"use server";

// ============================================================
// Server actions de finanzas — modelo cargos/cobros (post-028).
//
// Toda escritura va a cargos / cobros / imputaciones. Las funciones
// "registrarPago", "cargarCreditos", etc. quedan como wrappers
// deprecados que conservan la signature vieja para no romper a los
// componentes que aún las llaman. Se eliminan cuando la UI termine
// de migrar (tasks 4-5).
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getPlan } from "@/lib/plan";
import type {
  CategoriaGasto, EstadoPago, MedioPago, ModeloCobro,
} from "@/lib/types/database";
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

function revalidarFinanzas() {
  revalidateTag(TAG.PAGOS, "max");
  revalidateTag(TAG.RESUMEN_FINANCIERO, "max");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/cobranzas");
  revalidatePath("/dashboard");
}

// ============================================================
// TARIFAS (sin cambios — tarifas no se refactoriza)
// ============================================================

export async function guardarTarifa(data: { valor_hora: number; notas?: string }) {
  const parsed = GuardarTarifaSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  await supabase
    .from("tarifas")
    .update({ activa: false })
    .eq("maestra_id", user.id)
    .eq("activa", true);

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

export async function aplicarTarifaSugerida(valorNuevo: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const plan = await getPlan(supabase, user.id);
  if (plan !== "premium") {
    throw new Error("Aplicar la sugerencia con un click es una función Premium.");
  }
  if (valorNuevo <= 0 || valorNuevo > 10_000_000) {
    throw new Error("El valor sugerido está fuera de rango.");
  }

  await supabase
    .from("tarifas")
    .update({ activa: false })
    .eq("maestra_id", user.id)
    .eq("activa", true);

  const { error } = await supabase.from("tarifas").insert({
    maestra_id: user.id,
    valor_hora: valorNuevo,
    vigente_desde: new Date().toISOString().split("T")[0],
    activa: true,
    notas: "Aplicada desde sugerencia por inflación",
  });
  if (error) throw new Error("No se pudo aplicar la nueva tarifa: " + error.message);

  revalidateTag(TAG.TARIFAS, "max");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/tarifas");
}

// ============================================================
// GASTOS (sin cambios)
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
    categoriaEnum = (cat.enum_legacy as CategoriaGasto | null) ?? "otro";
  } else {
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
// CARGOS — manual + ajustes
// ============================================================

export async function registrarCargoManual(data: {
  alumno_id: string;
  monto: number;
  fecha?: string;
  descripcion?: string;
  periodo?: string;  // si viene, concepto='abono_mensual'
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const concepto = data.periodo ? "abono_mensual" : "ajuste";

  const { error } = await supabase.from("cargos").insert({
    maestra_id: user.id,
    alumno_id: data.alumno_id,
    fecha: data.fecha || new Date().toISOString().split("T")[0],
    concepto,
    monto: data.monto,
    periodo: data.periodo || null,
    descripcion: data.descripcion || null,
  });
  if (error) throw new Error(error.message);

  revalidarFinanzas();
}

export async function actualizarCargo(id: string, data: {
  monto?: number;
  fecha?: string;
  descripcion?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const patch: Record<string, unknown> = {};
  if (data.monto !== undefined)        patch.monto = data.monto;
  if (data.fecha !== undefined)        patch.fecha = data.fecha;
  if (data.descripcion !== undefined)  patch.descripcion = data.descripcion;

  const { error } = await supabase
    .from("cargos")
    .update(patch)
    .eq("id", id)
    .eq("maestra_id", user.id)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  revalidarFinanzas();
}

export async function eliminarCargo(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("cargos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("maestra_id", user.id)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  revalidarFinanzas();
}

// ============================================================
// COBROS — recepción de plata
// ============================================================

export async function registrarCobro(data: {
  alumno_id: string;
  monto: number;
  fecha?: string;
  medio_pago?: MedioPago;
  nota?: string;
  comprobante_url?: string | null;
  creditos_otorgados?: number;  // solo para packs
  origen?: "manual" | "pack" | "mercadopago";
  imputaciones?: LineaImputacion[];  // opcional: a qué cargos se aplica
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const origen = data.origen || "manual";
  const creditos = data.creditos_otorgados || 0;
  if (creditos > 0 && origen !== "pack") {
    throw new Error("Solo los cobros con origen 'pack' otorgan créditos.");
  }

  const { data: cobro, error: errCobro } = await supabase
    .from("cobros")
    .insert({
      maestra_id: user.id,
      alumno_id: data.alumno_id,
      fecha: data.fecha || new Date().toISOString().split("T")[0],
      monto: data.monto,
      medio_pago: data.medio_pago || null,
      comprobante_url: data.comprobante_url || null,
      nota: data.nota || null,
      origen,
      creditos_otorgados: creditos,
    })
    .select("id")
    .single();
  if (errCobro) throw new Error("Error al registrar el cobro: " + errCobro.message);

  const cobroId = (cobro as { id: string }).id;

  if (data.imputaciones && data.imputaciones.length > 0) {
    const filas = data.imputaciones.map((i) => ({
      cobro_id: cobroId,
      cargo_id: i.clase_id,  // LineaImputacion usa "clase_id" por legacy; en realidad es cargo_id
      monto_imputado: i.monto_imputado,
    }));
    const { error: errImp } = await supabase.from("imputaciones").insert(filas);
    if (errImp) throw new Error("Error al guardar imputaciones: " + errImp.message);
  }

  revalidarFinanzas();
  return { cobro_id: cobroId };
}

export async function actualizarCobro(id: string, data: {
  monto?: number;
  fecha?: string;
  medio_pago?: MedioPago | null;
  nota?: string | null;
  comprobante_url?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const patch: Record<string, unknown> = {};
  if (data.monto !== undefined)            patch.monto = data.monto;
  if (data.fecha !== undefined)            patch.fecha = data.fecha;
  if (data.medio_pago !== undefined)       patch.medio_pago = data.medio_pago;
  if (data.nota !== undefined)             patch.nota = data.nota;
  if (data.comprobante_url !== undefined)  patch.comprobante_url = data.comprobante_url;

  const { error } = await supabase
    .from("cobros")
    .update(patch)
    .eq("id", id)
    .eq("maestra_id", user.id)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  revalidarFinanzas();
}

export async function eliminarCobro(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("cobros")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("maestra_id", user.id)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  revalidarFinanzas();
}

// ============================================================
// ABONO MENSUAL — ahora vive en columnas de alumnos
// ============================================================

export async function guardarAbono(data: {
  alumno_id: string;
  monto_mensual: number;
  tope_clases_mes?: number | null;
  notas?: string;  // ignorado: ya no hay tabla abonos
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("alumnos")
    .update({
      monto_abono_mensual: data.monto_mensual,
      tope_clases_mes: data.tope_clases_mes ?? null,
    })
    .eq("id", data.alumno_id)
    .eq("maestra_id", user.id);
  if (error) throw new Error(error.message);

  revalidarFinanzas();
}

// ============================================================
// WRAPPERS DEPRECADOS — preservan signatures viejas para los
// componentes que aún no migraron a las APIs nuevas.
// ============================================================

/** @deprecated Usar registrarCobro o registrarCargoManual. */
export async function registrarPago(data: {
  alumno_id: string;
  clase_id?: string;
  monto: number;
  estado: EstadoPago;
  fecha_pago?: string;
  nota?: string;
  periodo?: string;
}) {
  const parsed = RegistrarPagoSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }

  if (parsed.data.estado === "pendiente") {
    await registrarCargoManual({
      alumno_id: parsed.data.alumno_id,
      monto: parsed.data.monto,
      fecha: parsed.data.fecha_pago,
      descripcion: parsed.data.nota,
      periodo: parsed.data.periodo,
    });
  } else if (parsed.data.estado === "pagado" || parsed.data.estado === "parcial") {
    await registrarCobro({
      alumno_id: parsed.data.alumno_id,
      monto: parsed.data.monto,
      fecha: parsed.data.fecha_pago,
      nota: parsed.data.nota,
    });
  }
  // 'cancelado' es un no-op en el modelo nuevo
}

/** @deprecated Usar registrarCobro con origen='pack' y creditos_otorgados. */
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

  await registrarCobro({
    alumno_id: parsed.data.alumno_id,
    monto: parsed.data.monto,
    nota: data.nota || `Pack de ${parsed.data.creditos} créditos`,
    creditos_otorgados: parsed.data.creditos,
    origen: "pack",
  });
}

/** @deprecated cuenta_corriente desapareció como modelo. Usar registrarCobro. */
export async function registrarPagoCuentaCorriente(data: {
  alumno_id: string;
  monto: number;
  nota?: string;
}) {
  const parsed = RegistrarPagoCuentaCorrienteSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(". "));
  }
  await registrarCobro({
    alumno_id: parsed.data.alumno_id,
    monto: parsed.data.monto,
    nota: parsed.data.nota,
  });
}

/** @deprecated Eliminar. La transición pendiente→pagado se hace via confirmarPago. */
export async function actualizarEstadoPago(_id: string, _estado: EstadoPago) {
  throw new Error(
    "actualizarEstadoPago: no soportado. Usar confirmarPago (cobro+imputación) o actualizarCargo."
  );
}

/** @deprecated Usar actualizarCargo o actualizarCobro según corresponda.
 *  La vista pagos_activos retorna SIEMPRE rows que son cargos, así que
 *  el `id` que se le pasa acá es un cargo_id. */
export async function actualizarPago(id: string, data: {
  monto: number;
  estado: EstadoPago;
  fecha_pago?: string | null;
  nota?: string | null;
  periodo?: string | null;
}) {
  // En el modelo nuevo, lo único que se puede editar de un cargo
  // (pendiente o no) es monto/fecha/descripción. fecha_pago, estado
  // y periodo no son atributos del cargo:
  //   - estado se deriva de imputaciones (no editable directo)
  //   - fecha_pago vive en cobros
  //   - periodo solo importa para abono_mensual (no editable post-creación)
  // Si la maestra quiere "marcar pagado" un cargo, debe usar el flujo
  // de confirmarPago (que inserta cobro + imputación).
  await actualizarCargo(id, {
    monto: data.monto,
    fecha: data.fecha_pago ?? undefined,
    descripcion: data.nota ?? undefined,
  });
}

/** @deprecated Usar eliminarCargo (la vista pagos_activos retorna cargos). */
export async function eliminarPago(id: string) {
  await eliminarCargo(id);
}

// ============================================================
// CONFIRMAR COBRO — flujo principal para "marcar pagado un cargo"
//
// Reemplaza el viejo confirmarPago. El `pago_id` que recibe es
// internamente un cargo_id (gracias a la vista compat pagos_activos).
//
// Crea un cobro nuevo + imputación al cargo. Las imputaciones
// extras (a otros cargos del alumno) son opcionales.
// ============================================================

export async function confirmarPago(input: {
  pago_id: string;         // = cargo_id en el modelo nuevo
  monto: number;
  estado: EstadoPago;      // 'pagado' | 'parcial'
  medio_pago: MedioPago;
  fecha_pago: string;
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

  // Verificar que el cargo exista y sea de la maestra
  const { data: cargo } = await supabase
    .from("cargos")
    .select("id, alumno_id, monto")
    .eq("id", parsed.data.pago_id)
    .eq("maestra_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!cargo) throw new Error("El cobro ya no existe o no es tuyo.");

  // Imputaciones: si vinieron explícitas, validar y usarlas. Sino,
  // imputar todo al cargo en cuestión.
  let imputaciones: LineaImputacion[];
  if (input.imputaciones && input.imputaciones.length > 0) {
    const { data: pendientesRaw } = await supabase.rpc(
      "clases_pendientes_imputacion",
      { p_alumno_id: cargo.alumno_id }
    );
    const pendientes = (pendientesRaw ?? []) as Array<{
      clase_id: string; fecha: string; tema: string;
      monto_total: number; monto_imputado: number; pendiente: number;
    }>;
    validarImputacionManual(pendientes, input.imputaciones, parsed.data.monto);
    imputaciones = input.imputaciones;
  } else {
    imputaciones = [{
      clase_id: parsed.data.pago_id,
      monto_imputado: Math.min(parsed.data.monto, Number(cargo.monto)),
    }];
  }

  // Insert cobro + imputaciones via la action limpia
  await registrarCobro({
    alumno_id: cargo.alumno_id,
    monto: parsed.data.monto,
    fecha: parsed.data.fecha_pago,
    medio_pago: parsed.data.medio_pago,
    comprobante_url: parsed.data.comprobante_url,
    nota: parsed.data.nota,
    imputaciones,
  });
}

// ============================================================
// Type re-exports para que los callers TS no rompan
// ============================================================

export type { ModeloCobro };
