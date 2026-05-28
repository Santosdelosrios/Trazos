"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function eliminarClase(claseAlumnoId: string) {
  const supabase = await createClient();
  console.log("Intentando eliminar clase_alumno_id:", claseAlumnoId);

  // 1. Obtener datos para saber qué más borrar (clase_id, alumno_id)
  const { data: registro, error: errorRegistro } = await supabase
    .from("clase_alumnos")
    .select("clase_id, alumno_id")
    .eq("id", claseAlumnoId)
    .single();

  if (!registro || errorRegistro) {
    console.error("Error obteniendo registro:", errorRegistro);
    return { error: "No se encontró el registro" };
  }
  console.log("Registro encontrado:", registro);

  // 2. Borrar hitos de aprendizaje asociados
  const { error: errorHitos } = await supabase
    .from("hitos_aprendizaje")
    .delete()
    .eq("clase_alumno_id", claseAlumnoId);
  if (errorHitos) console.error("Error borrando hitos:", errorHitos);

  // 3. Borrar el registro de clase_alumno
  const { error: errorCA } = await supabase
    .from("clase_alumnos")
    .delete()
    .eq("id", claseAlumnoId);

  if (errorCA) {
    console.error("Error borrando clase_alumno:", errorCA);
    return { error: errorCA.message };
  }

  // 4. Soft delete del cargo asociado a esa clase específica.
  //    Las imputaciones que apunten a este cargo se cancelan ON DELETE
  //    CASCADE de imputaciones, pero como acá es soft delete, se
  //    "ignoran" naturalmente porque cargos_activos las filtra.
  const { error: errorCargo } = await supabase
    .from("cargos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("clase_id", registro.clase_id)
    .eq("alumno_id", registro.alumno_id)
    .is("deleted_at", null);
  if (errorCargo) console.error("Error borrando cargo:", errorCargo);

  // 5. Opcional: Podríamos borrar la clase si no tiene más alumnos vinculados
  const { error: errorClase } = await supabase
    .from("clases")
    .delete()
    .eq("id", registro.clase_id);
  if (errorClase) console.error("Error borrando clase:", errorClase);

  console.log("Eliminación exitosa. Revalidando rutas...");

  revalidatePath("/clases");
  revalidatePath("/dashboard");
  revalidatePath(`/alumnos/${registro.alumno_id}`);

  return { success: true };
}

/**
 * Editor de pago para una clase específica (post-cierre).
 *
 * Mapeo al modelo nuevo:
 *   - cargo: hay 1 cargo concepto='clase' por (clase, alumno). Se
 *     asegura que exista con el monto pedido.
 *   - estado:
 *       pendiente  → borra cualquier imputación a este cargo
 *       pagado     → asegura un cobro de monto completo + imputación 1:1
 *       parcial    → como pagado pero el monto del cobro es el editado
 *                    (la imputación cubre solo eso; el resto queda en saldo)
 *       cancelado  → soft-delete del cargo
 */
export async function actualizarPagoClase(data: {
  clase_id: string;
  alumno_id: string;
  clase_alumno_id: string;
  monto: number;
  estado: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // 1. Cancelado: soft-delete del cargo y listo.
  if (data.estado === "cancelado") {
    await supabase
      .from("cargos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("clase_id", data.clase_id)
      .eq("alumno_id", data.alumno_id)
      .is("deleted_at", null);
    revalidatePath(`/clases/${data.clase_alumno_id}`);
    revalidatePath("/finanzas");
    revalidatePath("/clases");
    return;
  }

  // 2. Buscar el cargo existente (o reabrirlo si estaba soft-deleted)
  const { data: cargoExistente } = await supabase
    .from("cargos")
    .select("id, monto")
    .eq("clase_id", data.clase_id)
    .eq("alumno_id", data.alumno_id)
    .is("deleted_at", null)
    .maybeSingle();

  let cargoId: string;
  if (cargoExistente) {
    cargoId = cargoExistente.id as string;
    if (Number(cargoExistente.monto) !== data.monto) {
      await supabase.from("cargos").update({ monto: data.monto }).eq("id", cargoId);
    }
  } else {
    // Obtener fecha de la clase para que el cargo tenga la fecha correcta
    const { data: clase } = await supabase
      .from("clases")
      .select("fecha")
      .eq("id", data.clase_id)
      .maybeSingle();
    const fechaClase = (clase?.fecha as string | undefined)?.slice(0, 10)
      ?? new Date().toISOString().slice(0, 10);

    const { data: nuevo, error } = await supabase
      .from("cargos")
      .insert({
        maestra_id: user.id,
        alumno_id: data.alumno_id,
        clase_id: data.clase_id,
        fecha: fechaClase,
        concepto: "clase",
        monto: data.monto,
        descripcion: "Clase",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    cargoId = (nuevo as { id: string }).id;
  }

  // 3. Sincronizar imputaciones según estado.
  if (data.estado === "pendiente") {
    // Remover cualquier imputación a este cargo (la clase deja de
    // estar pagada). Los cobros quedan como saldo a favor.
    await supabase.from("imputaciones").delete().eq("cargo_id", cargoId);
  } else {
    // pagado / parcial: crear cobro + imputación si no hay todavía
    const { data: imputacionExistente } = await supabase
      .from("imputaciones")
      .select("id, monto_imputado")
      .eq("cargo_id", cargoId)
      .limit(1)
      .maybeSingle();

    if (!imputacionExistente) {
      const { data: cobro, error: errCobro } = await supabase
        .from("cobros")
        .insert({
          maestra_id: user.id,
          alumno_id: data.alumno_id,
          fecha: new Date().toISOString().split("T")[0],
          monto: data.monto,
          nota: data.estado === "parcial" ? "Pago parcial" : null,
          origen: "manual",
        })
        .select("id")
        .single();
      if (errCobro) throw new Error(errCobro.message);

      await supabase.from("imputaciones").insert({
        cobro_id: (cobro as { id: string }).id,
        cargo_id: cargoId,
        monto_imputado: data.monto,
      });
    }
  }

  revalidatePath(`/clases/${data.clase_alumno_id}`);
  revalidatePath("/finanzas");
  revalidatePath("/clases");
}
