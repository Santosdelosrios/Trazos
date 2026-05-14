"use server";

import { createClient } from "@/lib/supabase/server";
import type { Grado, EjercicioGenerado } from "@/lib/types/database";

export async function createClaseAndVinculo(data: {
  temas: string[];
  materia: string;
  grado_target: Grado;
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
      grado_target: data.grado_target,
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

  // 2. Crear el pago
  const { error } = await supabase.from("pagos").insert({
    maestra_id: user.id,
    alumno_id: data.alumno_id,
    clase_id: data.clase_id,
    monto: data.monto,
    estado: data.estado,
    fecha_pago: data.estado === "pagado" ? new Date().toISOString().split("T")[0] : null,
  });

  if (error) throw new Error("Error al registrar cobro: " + error.message);
}
