"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Materia } from "@/lib/types/database";

export async function planificarClase(data: {
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
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const recordsToInsert = [];
  const cantidadSemanas = data.repetirSemanal ? (data.semanas || 1) : 1;

  for (let i = 0; i < cantidadSemanas; i++) {
    const fechaClase = new Date(data.fecha + "T12:00:00");
    fechaClase.setDate(fechaClase.getDate() + (i * 7));
    
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
  const { error } = await supabase.from("agenda").delete().eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
}

export async function completarPlanificacion(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda")
    .update({ estado: "completada" })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
}

export async function actualizarHorarioClase(id: string, fecha: string, hora: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda")
    .update({ fecha, hora })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
}

export async function actualizarClase(id: string, data: {
  hora: string;
  alumno_id: string;
  tarifa_esperada: number;
  tema_previsto: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda")
    .update({ 
      hora: data.hora,
      alumno_id: data.alumno_id,
      tarifa_esperada: data.tarifa_esperada,
      tema_previsto: data.tema_previsto
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
}

export async function actualizarDuracionClase(id: string, duracion_estimada: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda")
    .update({ duracion_estimada })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/agenda");
}
