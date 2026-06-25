import { z } from 'zod';

const stockDistribucionSchema = z.object({
    id_lote: z.string().uuid('ID de lote inválido.'),
    id_ubicacion: z.string().uuid('ID de ubicación inválido.'),
    cantidad_actual: z.number().nonnegative('La cantidad debe ser no negativa.'),
});

export const trasladoStockSchema = z.object({
    id_lote: z.string().uuid('ID de lote inválido.'),
    id_ubicacion_origen: z.string().uuid('ID de ubicación de origen inválido.'),
    id_ubicacion_destino: z.string().uuid('ID de ubicación de destino inválido.'),
    cantidad: z.number().positive('La cantidad a trasladar debe ser mayor a cero.'),
    observacion: z.string().optional()
});

export const createStockDistribucionSchema = stockDistribucionSchema;
export const updateStockDistribucionSchema = stockDistribucionSchema.partial();

export const ajusteStockSchema = z.object({
    cantidad: z.number().refine(val => val !== 0, { message: 'La cantidad de ajuste no puede ser cero.' }),
    observacion: z.string().min(1, 'La observación es obligatoria para realizar un ajuste.')
});
