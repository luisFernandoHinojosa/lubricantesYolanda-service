import { z } from 'zod';

export const TIPOS_MOVIMIENTO = ['INGRESO', 'VENTA', 'TRASLADO', 'AJUSTE', 'DEVOLUCION', 'ANULACION'];
export const NATURALEZAS = ['ENTRADA', 'SALIDA', 'NEUTRO'];
export const SORT_FIELDS = ['fecha', 'cantidad', 'producto', 'tipo_movimiento'];

// Los query params vacíos ('') se tratan como ausentes
const opcional = (schema) => z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

const uuid = z.string().uuid('ID inválido.');
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD.');

// Acepta "VENTA" o "VENTA,AJUSTE"
const tiposMovimiento = z
    .string()
    .transform((v) => v.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean))
    .pipe(z.array(z.enum(TIPOS_MOVIMIENTO)));

const paginacion = {
    page: opcional(z.coerce.number().int().min(1)),
    perPage: opcional(z.coerce.number().int().min(1).max(100)),
};

const filtrosComunes = {
    desde: opcional(fecha),
    hasta: opcional(fecha),
    id_sucursal: opcional(uuid),
    id_ubicacion: opcional(uuid),
    id_lote: opcional(uuid),
    tipo_movimiento: opcional(tiposMovimiento),
    naturaleza: opcional(z.enum(NATURALEZAS)),
};

const validarRango = (q) => !q.desde || !q.hasta || q.desde <= q.hasta;
const mensajeRango = { message: 'La fecha "desde" no puede ser mayor que "hasta".', path: ['desde'] };

export const listKardexSchema = z.object({
    body: z.any(),
    params: z.object({}).passthrough(),
    query: z.object({
        ...paginacion,
        ...filtrosComunes,
        search: opcional(z.string().trim().max(100)),
        id_producto: opcional(uuid),
        id_usuario: opcional(uuid),
        sortBy: opcional(z.enum(SORT_FIELDS)),
        sortOrder: opcional(z.preprocess((v) => String(v).toUpperCase(), z.enum(['ASC', 'DESC']))),
    }).refine(validarRango, mensajeRango),
});

export const getKardexSchema = z.object({
    body: z.any(),
    params: z.object({ id: uuid }),
    query: z.any(),
});

export const tarjetaKardexSchema = z.object({
    body: z.any(),
    params: z.object({ id_producto: uuid }),
    query: z.object({
        ...paginacion,
        ...filtrosComunes,
        sortOrder: opcional(z.preprocess((v) => String(v).toUpperCase(), z.enum(['ASC', 'DESC']))),
    }).refine(validarRango, mensajeRango),
});
