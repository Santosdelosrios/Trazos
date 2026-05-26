// ============================================================
// Cache tags — Convención unificada para revalidación quirúrgica
//
// En vez de revalidatePath("/alumnos") + revalidatePath("/dashboard")
// + revalidatePath("/finanzas") tras cada mutación, taggeamos los
// datos de cada entidad y revalidamos por tag. Una mutación que
// afecta "alumnos" invalida automáticamente cualquier página que
// haya tagged sus fetches con "alumnos".
//
// Uso típico en una page:
//   const data = await fetch(..., { next: { tags: [TAG.ALUMNOS] } });
//
// Uso típico en una server action:
//   revalidateTag(TAG.ALUMNOS);
//
// Para datos que dependen de la maestra logueada, prefijamos con su id:
//   tagForMaestra(TAG.ALUMNOS, maestraId)
// ============================================================

export const TAG = {
  ALUMNOS: "alumnos",
  CLASES: "clases",
  AGENDA: "agenda",
  PAGOS: "pagos",
  GASTOS: "gastos",
  TARIFAS: "tarifas",
  RESUMEN_FINANCIERO: "resumen-financiero",
  HITOS: "hitos",
  PERFIL: "perfil",
  FAMILIAS: "familias",
} as const;

export type TagName = (typeof TAG)[keyof typeof TAG];

/**
 * Construye un tag scopeado por maestra. Útil para invalidaciones
 * que sólo afectan a un usuario específico.
 */
export function tagForMaestra(tag: TagName, maestraId: string): string {
  return `${tag}:${maestraId}`;
}
