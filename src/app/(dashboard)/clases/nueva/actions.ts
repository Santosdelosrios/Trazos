"use server";

import { createClient } from "@/lib/supabase/server";
import type { EjercicioGenerado } from "@/lib/types/database";
import { aplicarModeloCobroCierre } from "@/lib/finanzas/cierreClase";

export async function createClaseAndVinculo(data: {
  temas: string[];
  materia: string;
  nivel_target: string;
  alumno_id: string;
  ejercicios_generados: EjercicioGenerado[];
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No autenticado");
  }

  // 1. Buscar o crear todos los temas
  const temaIds: string[] = [];
  const temasNombres = data.temas.map(t => t.trim());

  for (const nombre of temasNombres) {
    const { data: existingTema } = await supabase
      .from("temas")
      .select("id")
      .eq("maestra_id", user.id)
      .ilike("nombre", nombre)
      .eq("materia", data.materia)
      .maybeSingle();

    if (existingTema) {
      temaIds.push(existingTema.id);
    } else {
      const { data: newTema, error: errorNewTema } = await supabase
        .from("temas")
        .insert({
          maestra_id: user.id,
          nombre: nombre,
          materia: data.materia,
        })
        .select("id")
        .single();

      if (errorNewTema || !newTema) {
        throw new Error(`Error al crear el tema "${nombre}": ` + errorNewTema?.message);
      }
      temaIds.push(newTema.id);
    }
  }

  const primaryTemaNombre = temasNombres.join(", ");
  const primaryTemaId = temaIds[0];

  // 2. Crear la clase
  const { data: clase, error: errorClase } = await supabase
    .from("clases")
    .insert({
      maestra_id: user.id,
      tema: primaryTemaNombre,
      materia: data.materia,
      grado_target: data.nivel_target,
      ejercicio_generado: data.ejercicios_generados as any,
      tema_id: primaryTemaId,
    })
    .select("id")
    .single();

  if (errorClase || !clase) {
    throw new Error("Error al crear la clase: " + errorClase?.message);
  }

  // 2.5 Vincular todos los temas a la clase en la tabla intermedia
  const claseTemas = temaIds.map(tId => ({
    clase_id: clase.id,
    tema_id: tId
  }));

  const { error: errorClaseTemas } = await supabase
    .from("clases_temas")
    .insert(claseTemas);

  if (errorClaseTemas) {
    console.error("Error al vincular temas a clase:", errorClaseTemas);
  }

  // 3. Crear el vínculo clase_alumno
  const { data: claseAlumno, error: errorVinculo } = await supabase
    .from("clase_alumnos")
    .insert({
      clase_id: clase.id,
      alumno_id: data.alumno_id,
    })
    .select("id")
    .single();

  if (errorVinculo || !claseAlumno) {
    throw new Error("Error al vincular alumno a clase: " + errorVinculo?.message);
  }

  return {
    claseId: clase.id,
    claseAlumnoId: claseAlumno.id,
  };
}

export async function registrarCobroClase(data: {
  clase_id: string;
  alumno_id: string;
  monto: number;
  duracion_real: number;
  /** Conservado por compatibilidad con el caller actual: si la maestra marca
   *  la clase como "pagada" al cerrarla, generamos el pago en ese estado.
   *  Si "pendiente" (default), delegamos al helper unificado que respeta
   *  el flag de cobros automáticos. */
  estado: "pagado" | "pendiente";
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // 1. Actualizar la duración real en la tabla clases
  await supabase
    .from("clases")
    .update({ duracion_real: data.duracion_real })
    .eq("id", data.clase_id);

  // 2. Obtener fecha de la clase (para detectar excedentes mensuales)
  const { data: clase } = await supabase
    .from("clases")
    .select("fecha")
    .eq("id", data.clase_id)
    .maybeSingle();
  const fechaClase = (clase?.fecha as string | undefined)?.slice(0, 10)
    ?? new Date().toISOString().slice(0, 10);

  // 3. Si la maestra marcó "pagado" al cerrar, registramos directo el pago
  //    cobrado (mantiene el comportamiento previo de este caller). El helper
  //    unificado solo cubre el camino "pendiente" / movimientos.
  if (data.estado === "pagado") {
    // Validamos modelo: solo tiene sentido en por_clase y abono_mensual
    const { data: alumno } = await supabase
      .from("alumnos")
      .select("modelo_cobro")
      .eq("id", data.alumno_id)
      .maybeSingle();
    const modelo = alumno?.modelo_cobro || "por_clase";

    if (modelo === "por_clase" || modelo === "abono_mensual") {
      // Idempotencia: si ya hay un pago no soft-deleted para esta
      // clase+alumno (típicamente un "pendiente" creado por
      // aplicarModeloCobroCierre cuando el flag está activo), lo
      // actualizamos a "pagado" en vez de insertar otro y generar
      // doble cobro.
      const { data: existente } = await supabase
        .from("pagos")
        .select("id")
        .eq("clase_id", data.clase_id)
        .eq("alumno_id", data.alumno_id)
        .eq("maestra_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (existente) {
        const { error } = await supabase
          .from("pagos")
          .update({
            monto: data.monto,
            estado: "pagado",
            fecha_pago: new Date().toISOString().split("T")[0],
          })
          .eq("id", existente.id)
          .is("deleted_at", null);
        if (error) throw new Error("Error al actualizar cobro: " + error.message);
        return;
      }

      const { error } = await supabase.from("pagos").insert({
        maestra_id: user.id,
        alumno_id: data.alumno_id,
        clase_id: data.clase_id,
        monto: data.monto,
        estado: "pagado",
        fecha_pago: new Date().toISOString().split("T")[0],
        origen: "manual",
      });
      if (error) throw new Error("Error al registrar cobro: " + error.message);
      return;
    }
    // Para bolsa/cta corriente, "pagado" no aplica → cae al helper unificado.
  }

  // 4. Path por defecto: helper unificado (respeta flag y tope)
  await aplicarModeloCobroCierre(supabase, user.id, {
    clase_id: data.clase_id,
    alumno_id: data.alumno_id,
    monto: data.monto,
    fecha_clase: fechaClase,
    descripcion: "Clase cerrada con evaluación",
  });
}
