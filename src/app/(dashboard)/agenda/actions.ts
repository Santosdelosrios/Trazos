"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Materia } from "@/lib/types/database";
import {
  PlanificarClaseSchema,
  ActualizarClaseSchema,
  ActualizarHorarioSchema,
  ActualizarDuracionSchema,
  PlanClaseSchema,
} from "@/lib/validations/schemas";
import type { PlanClase } from "@/lib/types/database";

export async function planificarClase(rawInput: {
  alumno_id: string;
  fecha: string;
  hora: string;
  tema_previsto: string;
  materia: Materia;
  tarifa_esperada: number;
  duracion_estimada: number;
  repetirSemanal?: boolean;
  semanas?: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const data = PlanificarClaseSchema.parse(rawInput);

  const recordsToInsert = [];
  const cantidadSemanas = data.repetirSemanal ? (data.semanas || 1) : 1;

  for (let i = 0; i < cantidadSemanas; i++) {
    const fechaClase = new Date(data.fecha + "T12:00:00");
    fechaClase.setDate(fechaClase.getDate() + i * 7);

    recordsToInsert.push({
      maestra_id: user.id,
      alumno_id: data.alumno_id,
      fecha: fechaClase.toISOString().split("T")[0],
      hora: data.hora,
      tema_previsto: data.tema_previsto,
      materia: data.materia,
      tarifa_esperada: data.tarifa_esperada,
      duracion_estimada: data.duracion_estimada,
      estado: "pendiente",
    });
  }

  const { error } = await supabase.from("agenda").insert(recordsToInsert);

  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
}

export async function eliminarPlanificacion(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("agenda")
    .delete()
    .eq("id", id)
    .eq("maestra_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
}

export async function completarPlanificacion(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("agenda")
    .update({ estado: "completada" })
    .eq("id", id)
    .eq("maestra_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
}

export async function actualizarHorarioClase(
  id: string,
  fecha: string,
  hora: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const valid = ActualizarHorarioSchema.parse({ fecha, hora });

  const { error } = await supabase
    .from("agenda")
    .update({ fecha: valid.fecha, hora: valid.hora })
    .eq("id", id)
    .eq("maestra_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
}

export async function actualizarClase(
  id: string,
  rawInput: {
    hora: string;
    fecha: string;
    alumno_id: string;
    tema_previsto: string;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const valid = ActualizarClaseSchema.parse(rawInput);

  const { error } = await supabase
    .from("agenda")
    .update({
      hora: valid.hora,
      fecha: valid.fecha,
      alumno_id: valid.alumno_id,
      tema_previsto: valid.tema_previsto,
    })
    .eq("id", id)
    .eq("maestra_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
}

export async function actualizarDuracionClase(
  id: string,
  duracion_estimada: number
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const valid = ActualizarDuracionSchema.parse({ duracion_estimada });

  const { error } = await supabase
    .from("agenda")
    .update({ duracion_estimada: valid.duracion_estimada })
    .eq("id", id)
    .eq("maestra_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
}

export async function guardarPlanClase(id: string, plan: PlanClase) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const valid = PlanClaseSchema.parse(plan);

  const { error } = await supabase
    .from("agenda")
    .update({ plan_clase: valid })
    .eq("id", id)
    .eq("maestra_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
}

export async function cerrarClaseExpress(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  // 1. Obtener la cita de la agenda
  const { data: agenda, error: agendaError } = await supabase
    .from("agenda")
    .select("*")
    .eq("id", id)
    .eq("maestra_id", user.id)
    .single();

  if (agendaError || !agenda) throw new Error("Error al obtener la clase de la agenda");

  // 2. Obtener datos del alumno (grado + modelo de cobro)
  const { data: alumno } = await supabase
    .from("alumnos")
    .select("grado, modelo_cobro, tarifa_override")
    .eq("id", agenda.alumno_id)
    .single();

  const grado_target = alumno?.grado || 1;
  const modelo_cobro = alumno?.modelo_cobro || "por_clase";
  const temaNombre = agenda.tema_previsto || "Clase sin tema";

  // 3. Buscar o crear el tema
  const { data: existingTema } = await supabase
    .from("temas")
    .select("id")
    .eq("maestra_id", user.id)
    .ilike("nombre", temaNombre)
    .eq("materia", agenda.materia)
    .maybeSingle();

  let temaId = existingTema?.id;

  if (!temaId) {
    const { data: newTema } = await supabase
      .from("temas")
      .insert({
        maestra_id: user.id,
        nombre: temaNombre,
        materia: agenda.materia,
      })
      .select("id")
      .single();
    if (newTema) temaId = newTema.id;
  }

  // 4. Crear la clase
  const { data: clase, error: errorClase } = await supabase
    .from("clases")
    .insert({
      maestra_id: user.id,
      tema: temaNombre,
      materia: agenda.materia,
      grado_target: grado_target,
      duracion_real: agenda.duracion_estimada || 1,
      fecha: agenda.fecha,
      tema_id: temaId,
    })
    .select("id")
    .single();

  if (errorClase || !clase) throw new Error("Error al crear la clase");

  if (temaId) {
    await supabase.from("clases_temas").insert({
      clase_id: clase.id,
      tema_id: temaId
    });
  }

  // 5. Crear vínculo clase_alumno
  await supabase.from("clase_alumnos").insert({
    clase_id: clase.id,
    alumno_id: agenda.alumno_id,
  });

  // 6. Registrar cobro/movimiento según modelo de facturación
  const monto = agenda.tarifa_esperada || 0;

  switch (modelo_cobro) {
    case "por_clase":
      // Modelo original: crear un pago pendiente vinculado a la clase
      await supabase.from("pagos").insert({
        maestra_id: user.id,
        alumno_id: agenda.alumno_id,
        clase_id: clase.id,
        monto: monto,
        estado: "pendiente",
      });
      break;

    case "bolsa_creditos":
      // Descontar 1 crédito de la bolsa
      await supabase.from("movimientos_cuenta").insert({
        maestra_id: user.id,
        alumno_id: agenda.alumno_id,
        tipo_movimiento: "clase_descontada",
        monto: 0,
        creditos: -1,
        referencia_id: clase.id,
        descripcion: `Clase: ${temaNombre}`,
      });
      break;

    case "cuenta_corriente":
      // Registrar cargo (monto negativo = deuda)
      await supabase.from("movimientos_cuenta").insert({
        maestra_id: user.id,
        alumno_id: agenda.alumno_id,
        tipo_movimiento: "clase_descontada",
        monto: -monto,
        creditos: 0,
        referencia_id: clase.id,
        descripcion: `Clase: ${temaNombre}`,
      });
      break;

    case "abono_mensual":
      // No se genera cargo por clase individual.
      // El cargo es mensual y se gestiona desde Finanzas.
      break;
  }

  // 7. Marcar agenda como completada
  await supabase
    .from("agenda")
    .update({ estado: "completada" })
    .eq("id", id);

  revalidatePath("/agenda");
  revalidatePath("/clases");
  revalidatePath("/dashboard");
}
