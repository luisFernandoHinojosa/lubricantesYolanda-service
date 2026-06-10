import { z } from 'zod';

const paymentTypes = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'QR', 'CHEQUE', 'OTRO'];
const movementTypes = ['INGRESO', 'EGRESO'];

const movimientoSchema = z.object({
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.').max(150),
    monto: z.number().positive('El monto debe ser un número positivo.'),
    descripcion: z.string().optional().nullable(),
    fecha: z.coerce.date().optional(),
    tipo: z.enum(movementTypes),
    tipoPago: z.enum(paymentTypes),
    divisa: z.string().max(10).default('BOB'),
    categoriaMovimientoId: z.string().uuid('ID de categoría no válido.'),
    sucursalId: z.string().uuid('ID de sucursal no válido.').optional(),
    empleadoId: z.string().uuid('ID de empleado no válido.').optional(),
    esta_activo: z.boolean().optional(),
});

export const createMovimientoSchema = movimientoSchema;
export const updateMovimientoSchema = movimientoSchema.partial();

export const getMovimientosByRangeSchema = z.object({
    startDate: z.coerce.date({
        errorMap: () => ({ message: "La fecha de inicio no es válida." })
    }),
    endDate: z.coerce.date({
        errorMap: () => ({ message: "La fecha de fin no es válida." })
    }),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    perPage: z.coerce.number().int().positive().optional().default(20),
});
