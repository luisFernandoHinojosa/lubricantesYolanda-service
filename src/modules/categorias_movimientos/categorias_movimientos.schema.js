import { z } from 'zod';

const categoriaMovimientoSchema = z.object({
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.').max(100),
    descripcion: z.string().optional().nullable(),
    esta_activo: z.boolean().optional(),
    tipo: z.enum(['INGRESO', 'EGRESO'], {
        errorMap: () => ({ message: "El tipo debe ser 'INGRESO' o 'EGRESO'." })
    }),
});

export const createCategoriaMovimientoSchema = categoriaMovimientoSchema;
export const updateCategoriaMovimientoSchema = categoriaMovimientoSchema.partial();
