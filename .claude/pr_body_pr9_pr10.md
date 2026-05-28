PRs 7, 8, 9 y 10 del rediseño del módulo Finanzas. Apunta a `feat/finanzas-pr6-categorias-gastos` (PR #28) para mantener el stack.

**Nota sobre el formato**: los 4 PRs se acumularon en una sola rama porque tocan archivos compartidos (`finanzas/page.tsx`, `actions.ts`, `package.json`) y separarlos por hunks era frágil. Quedan en **un solo commit** con secciones bien delimitadas abajo. Funcionalmente cada bloque es independiente y se puede entender por separado en la review.

## PR-7 — Histórico, proyección y alertas inteligentes

### Schema (`023_historico_proyeccion_alertas.sql`)
- **`historico_finanzas(maestra_id, meses_atras)`**: CTE recursiva genera serie continua YYYY-MM de los últimos N meses. Meses sin movimientos aparecen con 0.
- **`proyeccion_mes(maestra_id, anio, mes)`**: combina pagos pagados + pendientes/parciales + **agenda no facturada** del mes (modelo `por_clase`, multiplicada por `tarifa_override` o global). Funciona incluso con `cobros_automaticos_clases=false`.
- **`alertas_finanzas(maestra_id)`**: 4 tipos calculadas on-demand. La caída de facturación solo se dispara después del día 10 del mes.

### Helper (`alertas.ts`)
- `presentarAlerta(alerta)` declarativo: cada tipo mappea a título + descripción + CTA + tono visual + ícono.
- `variacionPorcentual` con guard contra división por cero.

### UI
- `ProyeccionMesCard` en `/finanzas`: barra de progreso "cobrado/proyectado" + 3 números (facturado, por cobrar, proyectado). No se renderiza si todo es 0.
- `PanelAlertas`: card por alerta con ícono coloreado según severidad + CTA accionable.
- **`/finanzas/historico`** con Recharts via `dynamic({ ssr: false })` — el chunk solo se descarga al entrar, no infla el bundle del dashboard. Cards comparativas (ingresos / neto vs mes anterior con flecha y %) + gráfico combinado (barras + línea) + tabla mobile-friendly.

## PR-8 — Sugerencia de aumento por inflación

### Schema (`024_inflacion.sql` + `025_seed_inflacion.sql`)
- Tabla **`inflacion_mensual`** con RLS read-open para `authenticated`. Check sanity entre -50% y +500%/mes.
- RPC **`inflacion_acumulada(desde date)`**: producto compuesto vía `EXP(SUM(LN(1+ipc))) - 1`.
- RPC **`ultimo_mes_inflacion()`** para mostrar cobertura ("Datos hasta MMM 'YY").
- Seeder con **27 meses IPC INDEC** (2023-01 a 2025-03) idempotente vía `ON CONFLICT DO NOTHING`.

### Doc (`INFLACION.md`)
- Link directo al informe técnico INDEC.
- Snippet SQL listo para agregar mes nuevo + corregir un mes ya cargado.
- Nota sobre comportamiento ante meses faltantes (asumen 0%, subestiman — no rompen).

### Helpers (`inflacion.ts`)
- `redondearTarifa` con escalones progresivos (50 / 100 / 500 según magnitud), **siempre hacia arriba** para no quedar debajo de la inflación real.
- `calcularSugerencia` trata inflación negativa como 0 (no propone bajar tarifa).

### UI
- `SugerenciaTarifaCard` en `/finanzas/tarifas` con 4 estados (sin tarifa / al día / sugerencia Free / sugerencia Premium).
- Free → CTA "Aplicar con un click (Premium)" linkea a `/perfil`.
- Premium → botón "Actualizar mi tarifa" dispara `aplicarTarifaSugerida` (gated en el server con `getPlan()`).

## PR-9 — Cierre de mes (PDF)

### Schema (`026_reporte_mes.sql`)
- RPC **`reporte_mes(maestra_id, anio, mes)`** devuelve un `jsonb` con todo el dataset agregado en un solo round-trip: `resumen` (ingresos/gastos/neto + contadores), `comparativo` vs mes anterior con variación %, `top_alumnos` (top 5), `top_familias` (top 3), `gastos_por_categoria`.

### Helper (`reporteMes.ts`)
- `normalizarReporte(raw, nombreMaestra)` puro y testeable. Convierte numeric-string a number (quirk PostgREST).

### Route (`/api/reporte-mes/[periodo]/route.ts`)
- Formato `YYYY-MM`. Auth via cookie + RLS.
- **`pdf-lib`** A4 vertical con: header (mes destacado + maestra + emisión), resumen grid 3×1, comparativa textual con flechas, top alumnos/familias (nombre truncado, monto alineado), gastos por categoría, footer Trazos.
- Tipografías Helvetica embebidas (sin fonts externas).

### UI (`BotonCerrarMes.tsx`)
- Dropdown con últimos 12 meses capitalizados → fetch → blob → download nativo.
- Posicionado en el header de `/finanzas`.

## PR-10 — Briefing financiero de Tiza (Premium)

### Helper (`briefingFinanzas.ts`)
- `obtenerContextoBriefing` cruza 5 queries en paralelo para armar un contexto compacto.
- `buildPromptBriefing` pide **JSON estructurado** `{saludo, destacado, accion_sugerida}` con 5 reglas Trazos: no repetir números crudos, mencionar nombres, celebrar mejoras, sugerir 1 acción concreta, máx 3 frases.
- `briefingFallback` determinístico cuando Gemini no está disponible. Singular/plural correcto. Prioriza acción según deudores > proyección > genérico.

### Route (`/api/tiza/briefing-finanzas/route.ts`)
- **Gated a Premium** (403 si free).
- **`unstable_cache` TTL 6h**. Cache key incluye `maestra_id` + día del año (refresca al cambiar de día, no sirve el de ayer).
- Llama `gemini-2.5-flash` con `responseMimeType: "application/json"` y `temperature: 0.7`. Valida los 3 campos. Si Gemini falla → fallback transparente.

### UI (`BriefingTizaCard.tsx`)
- **Premium**: `useEffect` → fetch → render. Si falla devuelve `null` (no rompe el dashboard).
- **Free**: card con preview borroso (filter blur + opacity) + overlay con Crown + CTA "Probar Premium" → `/perfil`.
- Posicionada arriba en `/finanzas`, sobre la card "Te deben".

---

## Verificación

| Check | Resultado |
|---|---|
| `tsc --noEmit` | exit 0 |
| `vitest run` | **179 tests** pasan (52 nuevos: alertas 13, inflacion 16, reporteMes 7, briefingFinanzas 16) |
| ESLint | sin nuevos errores; el `any` que reporta en `finanzas/page.tsx:222` es **preexistente** |
| Migraciones | aditivas, nullable, idempotentes |

## Dependencias agregadas
- `recharts@^3.8.1` (PR-7, ~50kb gz, ya estaba aprobado en el plan original).
- `pdf-lib@^1.17.1` (PR-9, ~80kb gz, dependencia ya planeada).

## Notas para el reviewer

- **El briefing Tiza requiere `GEMINI_API_KEY`** en el entorno; si no está, el endpoint cae al fallback determinístico sin romper la UI.
- **PDF tipografías**: usa Helvetica de pdf-lib (built-in). Caracteres con tilde y ñ funcionan porque son ASCII extendido cubierto por la fuente standard.
- **Recharts via dynamic import**: el bundle del dashboard NO crece. El chunk se descarga solo al entrar a `/finanzas/historico`.
- **Inflación**: cuando salga el IPC de abril 2025 (o más nuevo), seguir las instrucciones de `INFLACION.md` para sumar la fila.

## Cómo probar

1. Aplicar migraciones `023`, `024`, `025`, `026` en Supabase **en orden**.
2. **PR-7**: en `/finanzas` deberías ver la card "Proyección de [mes]" + panel de alertas (si tu cuenta dispara alguna). El link "Histórico" en quick-actions abre `/finanzas/historico` con el gráfico.
3. **PR-8**: en `/finanzas/tarifas` aparece la card de sugerencia. Si sos Premium, podés aplicar; si sos Free, el botón redirige.
4. **PR-9**: botón "Cerrar mes" en el header de `/finanzas` → dropdown → descarga PDF.
5. **PR-10**: arriba de "Te deben $X" aparece la card de Tiza. Premium ve el briefing real (puede tardar 2-5s la primera vez por la llamada a Gemini, después es cache 6h); Free ve el preview borroso.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
