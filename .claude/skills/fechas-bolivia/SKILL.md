---
name: fechas-bolivia
description: Reglas para manejar fechas y horas en hora de Bolivia (America/La_Paz, UTC-4) en este backend y en su frontend (lubricantesYolanda-client). Úsala siempre que crees o modifiques un modelo con columnas de fecha (DataTypes.DATE / DATEONLY), filtros por rango de fecha (desde/hasta, startDate/endDate), endpoints o servicios de reportes (src/modules/reportes), dashboards, agrupaciones por día/semana/mes, correlativos con fecha (TK-, DEV-, PROF-), o cualquier código que use new Date(), toISOString(), dayjs o fechas "de hoy".
---

# Fechas en hora de Bolivia

El negocio opera en **America/La_Paz (UTC-4, sin horario de verano)**. Un día de Bolivia, por ejemplo el 21/10, va de `2026-10-21T04:00:00Z` a `2026-10-22T03:59:59.999Z`. Casi todos los errores de fecha vienen de calcular "el día" en UTC: después de las 20:00 en Bolivia ya es el día siguiente en UTC.

## Lo que ya está configurado (no duplicarlo)

- `src/database/connection.js`: Sequelize con `timezone: ZONA_HORARIA`. La sesión de Postgres está en hora de Bolivia, así que `DATE(col)`, `DATE_TRUNC(...)` y `NOW()::date` devuelven días bolivianos.
- `docker-compose.yml`: el backend corre con `TZ=America/La_Paz`.
- Las columnas `DataTypes.DATE` son `timestamptz`: guardan un **instante absoluto**. Guardar `new Date()` siempre está bien. El problema solo aparece al **derivar el día** o al **filtrar por días**.

## Helpers: usar siempre estos

Backend, `src/utils/fechas.js`:

| Helper | Devuelve | Uso |
|---|---|---|
| `fechaLocal(date?)` | `'YYYY-MM-DD'` del día en Bolivia | "hoy", fecha de un instante |
| `fechaCompacta(date?)` | `'YYYYMMDD'` | correlativos (`TK-XXXX-20261021-0001`) |
| `inicioDelMes(date?)` | `'YYYY-MM-01'` | rango por defecto "mes actual" |
| `aFechaLocal(valor)` | `'YYYY-MM-DD'` | normaliza un filtro: `'2026-10-21'` se queda igual, y un ISO `'...T01:00Z'` se convierte al día de Bolivia |
| `inicioDelDia(fecha)` / `finDelDia(fecha)` | `Date` (00:00:00.000 / 23:59:59.999 en Bolivia) | límites de un filtro por rango |
| `ZONA_HORARIA`, `UTC_OFFSET` | `'America/La_Paz'`, `'-04:00'` | configuración |

Reportes, `src/modules/reportes/reportes.helpers.js`:
- `parseDateRange(desde, hasta)` → `{ start, end }` en días de Bolivia. Sin parámetros, devuelve desde el 1 del mes actual hasta hoy.
- `getPeriodoAnterior(desde, hasta)` → el periodo anterior de la misma duración.
- `getGroupByExpression(agruparPor, sequelize, columna)` → `DATE` / `DATE_TRUNC`. Ya agrupa en hora de Bolivia gracias a la sesión de PG.

Frontend, `lubricantesYolanda-client/src/lib/utils/fechas.ts` (exportado desde `$lib/utils`):
- `fechaLocal(date?)` → `'YYYY-MM-DD'` en Bolivia. Úsalo para presets ("hoy", "ayer", "semana", "mes") y para los valores por defecto de `<input type="date">`.

## Reglas

1. **Nunca** `date.toISOString().split('T')[0]` ni `.slice(0, 10)` para obtener el día, ni en el backend ni en el frontend. Usa `fechaLocal(date)`.
2. **Nunca** `dayjs.utc(x).startOf('day')` / `endOf('day')` ni strings `` `${fecha} 00:00:00` `` en un `where`. Usa `inicioDelDia(fecha)` / `finDelDia(fecha)`, o `parseDateRange` en reportes.
3. **El contrato de filtros** es solo la fecha local `YYYY-MM-DD`, sin hora. El frontend la envía así y el backend la convierte con `inicioDelDia` / `finDelDia`, que también toleran un ISO completo.
4. **Elegir bien el tipo de columna** al crear un modelo:
   - Un **instante** (cuándo pasó algo: `createdAt`, `fecha_apertura`, `fecha` de un movimiento) → `DataTypes.DATE` con `defaultValue: DataTypes.NOW`.
   - Una **fecha de calendario** sin hora (nacimiento, vencimiento, contratación) → `DataTypes.DATEONLY`. No le apliques zona horaria: `'1990-05-10'` es `'1990-05-10'` en cualquier lugar. Al mostrarla en un input, no la pases por `fechaLocal` (mostraría un día menos). Basta con `valor.slice(0, 10)` o `formatDateForInput` en UTC.
   - Recuerda: cambiar un modelo **no altera la tabla existente** (`sync()` sin `alter`). Hace falta un script en `src/scripts/`.
5. **Rangos con `Op.between` o `>=`/`<=` sobre la columna**, con los `Date` de los helpers. No envuelvas la columna en `DATE(col)` dentro del `WHERE`, porque impide usar índices. `DATE()` es solo para agrupar.
6. **En SQL crudo**, pasa los límites como `replacements` de tipo `Date`. Sequelize los serializa con la zona configurada:
   ```js
   await sequelize.query(
     'SELECT ... FROM "Ventas" v WHERE v."createdAt" BETWEEN :start AND :end',
     { replacements: { start, end }, type: QueryTypes.SELECT }
   );
   ```
7. **Instantes relativos** ("próximos 30 días", "vence en N días"): la aritmética con milisegundos sobre `new Date()` está bien. Para comparar contra una columna `DATEONLY`, compara contra `fechaLocal()` (string), no contra un `Date`.
8. **Correlativos con fecha**: el prefijo usa `fechaCompacta()`. Para que dos operaciones simultáneas no obtengan el mismo número, sigue el patrón de `generarNumeroComprobante` en `src/modules/ventas/ventas.service.js`: `pg_advisory_xact_lock(hashtext(prefijo))` y después `MAX(...)`, dentro de la transacción.
9. **Respuestas del API**: devuelve los instantes tal cual (JSON en ISO UTC con `Z`). El frontend los formatea a hora local (`fmtDate`, `formatDateTime`). No los conviertas a string local en el backend.

## Patrones listos para copiar

Filtro por rango en un servicio de listado:
```js
import { inicioDelDia, finDelDia } from '../../utils/fechas.js';

if (query.desde || query.hasta) {
    where.createdAt = {};
    if (query.desde) where.createdAt[Op.gte] = inicioDelDia(query.desde);
    if (query.hasta) where.createdAt[Op.lte] = finDelDia(query.hasta);
}
```

Nuevo endpoint de reporte:
```js
import { parseDateRange, getGroupByExpression } from './reportes.helpers.js';

export const reporteX = async (query) => {
    const { desde, hasta, agrupar_por = 'dia' } = query;
    const { start, end } = parseDateRange(desde, hasta);   // días completos en Bolivia

    const filas = await Modelo.findAll({
        where: { createdAt: { [Op.between]: [start, end] } },
        attributes: [
            getGroupByExpression(agrupar_por, sequelize, 'createdAt'),  // agrupa por día boliviano
            [fn('SUM', col('total')), 'total'],
        ],
        group: ['fecha'],
        order: [[literal('fecha'), 'ASC']],
        raw: true,
    });
    // ...
};
```
Si el reporte agrupa sobre una columna de un include, pasa el nombre calificado (por ejemplo `'Compra.fecha_compra'`), como en `reporteCompras`.

Frontend, presets de filtro:
```ts
import { fechaLocal } from '$lib/utils';

const hoy = new Date();
filters.desde = fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); // inicio de mes
filters.hasta = fechaLocal(hoy);
```

## Checklist antes de terminar

- [ ] `grep -rn "toISOString()" src` no muestra usos nuevos para obtener el día (en el backend y en el frontend).
- [ ] Ningún `dayjs.utc(...).startOf('day')` nuevo, ni strings `"YYYY-MM-DD 00:00:00"` en un `where`.
- [ ] Las columnas nuevas usan `DATE` para instantes y `DATEONLY` para fechas de calendario, con su script de migración si la tabla ya existe.
- [ ] Los reportes nuevos usan `parseDateRange` + `getGroupByExpression`.
- [ ] Probado con un registro de **después de las 20:00** de Bolivia: debe aparecer en el día correcto al filtrar "hoy" y al agrupar por día.

Verificación rápida sin base de datos:
```bash
node --input-type=module -e "
const f = await import('./src/utils/fechas.js');
console.log(f.fechaCompacta(new Date('2026-10-21T01:00:00Z')));                          // 20261020
console.log(f.inicioDelDia('2026-10-21').toISOString(), f.finDelDia('2026-10-21').toISOString());
// 2026-10-21T04:00:00.000Z 2026-10-22T03:59:59.999Z
"
```
