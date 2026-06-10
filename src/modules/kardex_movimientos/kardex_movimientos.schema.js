import { z } from 'zod';

const kardexMovimientoSchema = z.object({
    id_lote: z.string().uuid('ID de lote inválido.'),
    tipo_movimiento: z.enum(['INGRESO', 'VENTA', 'TRASLADO', 'AJUSTE']),
    cantidad: z.number().positive('La cantidad debe ser positiva.'),
    id_ubicacion_origen: z.string().uuid('ID de ubicación origen inválido.').optional().nullable(),
    id_ubicacion_destino: z.string().uuid('ID de ubicación destino inválido.').optional().nullable(),
    id_usuario: z.string().uuid('ID de usuario inválido.').optional().nullable(),
    fecha: z.coerce.date().default(() => new Date()),
    observacion: z.string().optional(),
});

export const createKardexMovimientoSchema = kardexMovimientoSchema;
export const updateKardexMovimientoSchema = kardexMovimientoSchema.partial();
