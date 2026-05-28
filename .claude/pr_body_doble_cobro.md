## Bug

Al cerrar una clase, el sistema podía generar **dos cobros pendientes** para el mismo alumno: uno con el monto que la maestra eligió (manual) y otro automático con la tarifa por defecto. El saldo del alumno quedaba inflado al doble.

## Causa raíz

El módulo de cierre tiene dos puntos donde se insertan pagos:

1. **`crearPagoPendiente()`** en `cierreClase.ts` — llamado por `aplicarModeloCobroCierre()` cuando el flag de cobros automáticos está activo. INSERTA un nuevo pago sin verificar si ya existe.
2. **Path "pagado"** de `registrarCobroClase()` en `clases/nueva/actions.ts` — llamado desde el `PasoResumen` del wizard de cierre con evaluación. También hace INSERT directo.

Hay dos escenarios donde se llaman ambos para la misma clase:

- **Express + Evaluación**: la maestra cierra la clase como Express desde la agenda → `cerrarClaseExpress` → `aplicarModeloCobroCierre` crea pago #1. Después abre el wizard de evaluación y registra el cobro → `registrarCobroClase` crea pago #2.
- **Doble click**: el botón "Marcar pendiente" del `PasoResumen` no tiene debounce; un doble click rápido dispara dos requests, ambos insertan.
- **Race en agenda + wizard simultáneo** (raro pero posible si la maestra abre dos pestañas).

## Fix

**Idempotencia por `(clase_id, alumno_id)`** en los dos puntos de inserción:

### `crearPagoPendiente()`
```diff
+ // Idempotencia: si ya hay un pago no soft-deleted para esta
+ // clase y alumno, no creamos otro.
+ const { data: existente } = await supabase
+   .from("pagos")
+   .select("id")
+   .eq("clase_id", input.clase_id)
+   .eq("alumno_id", input.alumno_id)
+   .eq("maestra_id", maestraId)
+   .is("deleted_at", null)
+   .maybeSingle();
+
+ if (existente) {
+   return { pago_id: existente.id, ... };
+ }
+
  const { data, error } = await supabase.from("pagos").insert({ ... });
```

### `registrarCobroClase()` path "pagado"
Mismo guard, pero si encuentra un pago existente lo **actualiza a "pagado"** en vez de devolver el id. Esto cubre el flujo natural: el helper unificado dejó un "pendiente" → la maestra confirma como "pagado".

## Por qué esta solución

- **Robusta contra cualquier futuro caller**: no depende de identificar de dónde vino el doble. Si el invariante "una clase = un cobro" se respeta a nivel de inserción, ningún path puede romperlo.
- **Backward-compatible**: clases sin pago previo siguen funcionando idéntico.
- **No requiere migración**: es lógica TS pura.

## Verificación

| Check | Resultado |
|---|---|
| `tsc --noEmit` | exit 0 |
| `vitest run` | **180 tests** pasan (1 nuevo en `cierreClase.test.ts`: "por_clase con pago previo no duplica") |
| Riesgo | bajo: cambio aditivo (guard antes del insert/update), no toca lógica existente |

## Cómo probar después del merge

1. Tener un alumno con modelo `por_clase` y `cobros_automaticos_clases = true`.
2. Cerrar una clase de ese alumno desde la agenda como **Express** → debería aparecer **1** cobro pendiente en `/finanzas/cobranzas`.
3. Abrir el wizard de evaluación para la misma clase → llegar al `PasoResumen` → marcar "Pagado" → debería **actualizarse** el cobro existente, no crear otro. Total: **1** cobro (ahora pagado).
4. Doble click en "Marcar pendiente" en el PasoResumen → solo **1** cobro generado.

## Nota: bug del CROSS JOIN en migración 023

Aparte de este fix, descubrí que el fix del `CROSS JOIN` que armé para la migración 023 (error 42P01) quedó fuera de PR #31 porque se mergeó antes de que pusheara el commit. Voy a abrir un PR aparte para llevarlo a main.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
