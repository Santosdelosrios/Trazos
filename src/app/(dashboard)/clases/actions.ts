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

  // 4. Soft delete del pago asociado (si existe para esa clase específica)
  const { error: errorPago } = await supabase
    .from("pagos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("clase_id", registro.clase_id)
    .eq("alumno_id", registro.alumno_id)
    .is("deleted_at", null);
  if (errorPago) console.error("Error borrando pago:", errorPago);

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

  // Determine payment date if transitioning to a paid state
  const isPaidState = data.estado === "pagado" || data.estado === "parcial";
  const fechaPago = isPaidState ? new Date().toISOString().split("T")[0] : null;

  // Check if payment exists (ignora soft-deleted)
  const { data: existingPago } = await supabase
    .from("pagos")
    .select("id")
    .eq("clase_id", data.clase_id)
    .eq("alumno_id", data.alumno_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingPago) {
    // Update existing
    const { error } = await supabase
      .from("pagos")
      .update({
        monto: data.monto,
        estado: data.estado,
        fecha_pago: fechaPago,
      })
      .eq("id", existingPago.id)
      .is("deleted_at", null);

    if (error) throw new Error(error.message);
  } else {
    // Insert new
    const { error } = await supabase
      .from("pagos")
      .insert({
        maestra_id: user.id,
        alumno_id: data.alumno_id,
        clase_id: data.clase_id,
        monto: data.monto,
        estado: data.estado,
        fecha_pago: fechaPago,
      });

    if (error) throw new Error(error.message);
  }

  revalidatePath(`/clases/${data.clase_alumno_id}`);
  revalidatePath("/finanzas");
  revalidatePath("/clases");
}
