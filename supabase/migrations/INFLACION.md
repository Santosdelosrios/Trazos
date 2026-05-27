# Actualización de la tabla `inflacion_mensual`

La tabla `public.inflacion_mensual` alimenta la card de **sugerencia de aumento de tarifa** en `/finanzas/tarifas`. Cada fila representa la variación porcentual mensual del IPC nacional INDEC.

La aplicación **no scrapea ni consume APIs externas** — los datos se cargan manualmente con SQL para evitar dependencias frágiles y mantener auditabilidad.

## Fuente oficial

- **INDEC, Informe Técnico mensual del IPC nacional**
  https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31

INDEC publica el informe del mes M alrededor del **día 12 del mes M+1** (ej: IPC de abril sale ~12 de mayo).

## Cuándo hay que actualizar

Sumar un mes nuevo cada vez que sale el informe de INDEC. Si te olvidás, la card sigue funcionando con el último mes disponible — la maestra ve un cartel que dice "Datos hasta MMM 'YY".

## Cómo agregar un mes nuevo

1. Abrir el [informe técnico del mes](https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31) en INDEC.
2. Buscar la fila **"Nivel general - Variación mensual"** del cuadro principal (NACIONAL).
3. Convertir el porcentaje a fracción decimal: `4.20%` → `0.0420`.
4. Insertar:

```sql
INSERT INTO public.inflacion_mensual (mes, ipc_mensual, fuente)
VALUES ('YYYY-MM-01', 0.0XXX, 'INDEC');
```

Ejemplo (IPC de abril 2025, hipotético 3.2%):

```sql
INSERT INTO public.inflacion_mensual (mes, ipc_mensual, fuente)
VALUES ('2025-04-01', 0.0320, 'INDEC');
```

## Corregir un mes ya cargado

A veces INDEC publica correcciones. El INSERT inicial usa `ON CONFLICT DO NOTHING` así que **no pisa**. Para actualizar:

```sql
UPDATE public.inflacion_mensual
   SET ipc_mensual = 0.0XXX
 WHERE mes = 'YYYY-MM-01';
```

## Verificar lo que está cargado

```sql
SELECT mes, ipc_mensual * 100 AS pct
  FROM public.inflacion_mensual
 ORDER BY mes DESC
 LIMIT 12;
```

## Qué pasa si falta un mes intermedio

La función `inflacion_acumulada(p_desde date)` ignora los meses faltantes (los trata como 0%), así que la inflación calculada queda **subestimada**. La UI muestra un cartel si detecta gaps. No es ideal pero evita errores ruidosos.

## Validación

La tabla acepta `ipc_mensual` entre `-0.5` y `5.0` (50% deflación hasta 500% mensual). Es un sanity check, no una validación de negocio.

---

**Nota**: si en el futuro queremos automatizar esto, los caminos son:
1. Endpoint admin que tome un payload JSON y haga el UPSERT (cron mensual manual).
2. Worker que scrape INDEC (frágil — el sitio cambia formato).
3. API externa (no encontré una oficial INDEC gratuita y estable).

Por ahora, **mantenerlo manual** es lo más simple y predecible.
