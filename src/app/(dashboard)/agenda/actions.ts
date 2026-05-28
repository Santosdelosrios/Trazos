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
import { aplicarModeloCobroCierre } from "@/lib/finanzas/cierreClase";

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
  diasSemana?: number[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const data = PlanificarClaseSchema.parse(rawInput);

  // Determinar fechas a generar:
  //   - Sin repetición → única fecha (data.fecha)
  //   - Con repetición + sin días específicos → mismo día N semanas
  //   - Con repetición + días específicos (ej: mar+jue) → para cada
  //     semana en [0..N), generamos una fila por cada día solicitado
  //     que caiga en o después de la fecha ancla.
  const fechas: string[] = [];
  const fechaAncla = new Date(data.fecha + "T12:00:00");

  if (!data.repetirSemanal) {
    fechas.push(data.fecha);
  } else {
    const semanas = data.semanas || 1;
    const dias = data.diasSemana && data.diasSemana.length > 0
      ? [...new Set(data.diasSemana)].sort((a, b) => a - b)
      : [fechaAncla.getDay()];

    // Inicio de la semana ancla (domingo como base).
    const inicioSemanaAncla = new Date(fechaAncla);
    inicioSemanaAncla.setDate(fechaAncla.getDate() - fechaAncla.getDay());

    for (let semana = 0; semana < semanas; semana++) {
      for (const dia of dias) {
        const fechaCandidata = new Date(inicioSemanaAncla);
        fechaCandidata.setDate(inicioSemanaAncla.getDate() + semana * 7 + dia);
        // Skip días anteriores a la fecha ancla en la semana 0.
        if (fechaCandidata < fechaAncla) continue;
        fechas.push(fechaCandidata.toISOString().split("T")[0]);
      }
    }
  }

  const recordsToInsert = fechas.map((fecha) => ({
    maestra_id: user.id,
    alumno_id: data.alumno_id,
    fecha,
    hora: data.hora,
    tema_previsto: data.tema_previsto,
    materia: data.materia,
    tarifa_esperada: data.tarifa_esperada,
    duracion_estimada: data.duracion_estimada,
    estado: "pendiente",
  }));

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

export async function completarPlanificacion(id: string, claseId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  // Linkear agenda.clase_id si vino. Sin esto, proyeccion_mes no
  // puede correlacionar la agenda con su cargo y la cuenta como
  // "por cobrar" aunque ya esté pagada.
  const patch: { estado: "completada"; clase_id?: string } = { estado: "completada" };
  if (claseId) patch.clase_id = claseId;

  const { error } = await supabase
    .from("agenda")
    .update(patch)
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

  // 2. Obtener datos del alumno (grado)
  const { data: alumno } = await supabase
    .from("alumnos")
    .select("grado")
    .eq("id", agenda.alumno_id)
    .single();

  const grado_target = alumno?.grado || 1;
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

  // 6. Aplicar lógica de cobro según el modelo del alumno + flag de maestra
  const monto = agenda.tarifa_esperada || 0;
  await aplicarModeloCobroCierre(supabase, user.id, {
    clase_id: clase.id,
    alumno_id: agenda.alumno_id,
    monto,
    fecha_clase: agenda.fecha,
    descripcion: `Clase: ${temaNombre}`,
  });

  // 7. Marcar agenda como completada y linkear la clase generada.
  //    Sin clase_id, proyeccion_mes cuenta esta clase en "por cobrar"
  //    aunque el cargo ya exista (LEFT JOIN ag.clase_id no matchea).
  await supabase
    .from("agenda")
    .update({ estado: "completada", clase_id: clase.id })
    .eq("id", id);

  revalidatePath("/agenda");
  revalidatePath("/clases");
  revalidatePath("/dashboard");
  revalidatePath("/finanzas");
}
